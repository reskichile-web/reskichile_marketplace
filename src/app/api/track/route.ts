import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

const VISITOR_COOKIE = 'rv_id'
const BOT_RE = /bot|crawl|spider|preview|lighthouse|headless|monitor|scrape|curl|wget/i
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Invite slugs: 8 chars from the unambiguous charset used by /api/admin/invite-link
const INVITE_SLUG_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/

const EVENT_TYPES = new Set(['pageview', 'product_view', 'click', 'login', 'signup', 'invite_open'])

// Fire-and-forget analytics ingest. Always answers 204 — a failed insert
// must never surface as an error in the visitor's console.
export async function POST(request: NextRequest) {
  const res = new NextResponse(null, { status: 204 })

  try {
    const ua = request.headers.get('user-agent') || ''
    if (BOT_RE.test(ua)) return res

    const body = await request.json().catch(() => null)
    const path = typeof body?.path === 'string' ? body.path : ''
    if (!path.startsWith('/') || path.length > 500) return res
    if (path.startsWith('/admin') || path.startsWith('/api')) return res

    const eventType = typeof body?.type === 'string' ? body.type : 'pageview'
    if (!EVENT_TYPES.has(eventType)) return res

    const eventName =
      typeof body?.name === 'string' && body.name.length <= 100 ? body.name : null
    const category =
      typeof body?.category === 'string' && body.category.length <= 100 ? body.category : null
    const productId =
      typeof body?.product_id === 'string' && UUID_RE.test(body.product_id)
        ? body.product_id
        : null
    const referrer =
      typeof body?.referrer === 'string' && body.referrer.length <= 500
        ? body.referrer
        : null

    // Anonymous visitor id (first-party cookie, 1 year)
    let visitorId = request.cookies.get(VISITOR_COOKIE)?.value ?? ''
    if (!UUID_RE.test(visitorId)) {
      visitorId = randomUUID()
      res.cookies.set(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      })
    }

    // Local cookie parse only — analytics doesn't need a verified user,
    // and getUser() would add a network round trip per event.
    const supabase = createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id ?? null

    const service = createServiceRoleClient()

    // Admin sessions don't count anywhere — not in visits, clicks or counters.
    if (userId) {
      const { data: profile } = await service
        .from('users')
        .select('is_admin')
        .eq('id', userId)
        .single()
      if (profile?.is_admin) return res
    }

    const country = request.headers.get('x-vercel-ip-country')
    const cityRaw = request.headers.get('x-vercel-ip-city')

    await service.from('events').insert({
      event_type: eventType,
      event_name: eventName,
      path,
      category,
      product_id: productId,
      visitor_id: visitorId,
      user_id: userId,
      referrer,
      user_agent: ua.slice(0, 300) || null,
      country,
      city: cityRaw ? decodeURIComponent(cityRaw) : null,
    })

    // First open of an invite link → stamp password_invites.opened_at
    if (eventType === 'invite_open' && eventName && INVITE_SLUG_RE.test(eventName)) {
      await service
        .from('password_invites')
        .update({ opened_at: new Date().toISOString() })
        .eq('slug', eventName)
        .is('opened_at', null)
    }
  } catch {
    // swallow — tracking must never break the page
  }

  return res
}
