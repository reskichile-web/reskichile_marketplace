import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { sanitizeCampaignAttribution } from '@/lib/campaign-attribution'
import {
  VISITOR_COOKIE,
  newVisitorId,
  readVisitorId,
  visitorCookieOptions,
} from '@/lib/visitor'

const BOT_RE = /bot|crawl|spider|preview|lighthouse|headless|monitor|scrape|curl|wget/i
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Invite slugs: 8 chars from the unambiguous charset used by /api/admin/invite-link
const INVITE_SLUG_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/

const EVENT_TYPES = new Set(['pageview', 'product_view', 'click', 'login', 'signup', 'invite_open'])
const CONTACT_INTENT_EVENTS = new Set(['contact_intent_whatsapp', 'contact_intent_chat'])

function hasSameRequestOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

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
    const isContactIntent =
      eventType === 'click' && eventName != null && CONTACT_INTENT_EVENTS.has(eventName)
    // Contact intent powers a business funnel, so accept only the two events
    // emitted by the product UI, with a real product and a same-origin POST.
    if (eventName?.startsWith('contact_intent_') && !isContactIntent) return res
    if (isContactIntent && (!productId || !hasSameRequestOrigin(request))) return res
    const referrer =
      typeof body?.referrer === 'string' && body.referrer.length <= 500
        ? body.referrer
        : null
    const attribution = sanitizeCampaignAttribution(body)

    // Anonymous visitor id. The proxy mints it on the document response, so by
    // the time any beacon lands the cookie normally exists and every event of
    // the visit shares one id. This stays as a fallback for the rare beacon
    // that arrives without one (cookie blocked, response not yet applied).
    let visitorId = readVisitorId(request)
    if (!visitorId) {
      visitorId = newVisitorId()
      res.cookies.set(VISITOR_COOKIE, visitorId, visitorCookieOptions())
    }

    // Contact intents are rare and need an accurate auth-state split in the
    // admin funnel. Only these events pay the session-validation round trip;
    // high-volume pageview/product_view beacons stay on the cheap path.
    let userId: string | null = null
    if (isContactIntent) {
      try {
        const session = createServerSupabaseClient()
        const { data } = await session.auth.getUser()
        userId = data.user?.id || null
      } catch {
        // A failed auth lookup is safely represented as no verified session.
      }
    }

    const service = createServiceRoleClient()

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
      ...(attribution ?? {}),
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
