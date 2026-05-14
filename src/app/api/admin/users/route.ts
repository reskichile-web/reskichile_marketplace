import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { promises as dns } from 'dns'

export const runtime = 'nodejs'

async function lookupMxDeliverable(domain: string, timeoutMs = 1500): Promise<boolean> {
  try {
    const lookup = dns.resolveMx(domain)
    const timed = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    )
    const records = await Promise.race([lookup, timed])
    return Array.isArray(records) && records.length > 0
  } catch {
    return false
  }
}

export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [usersRes, productsRes] = await Promise.all([
    admin
      .from('users')
      .select('id, email, name, phone, instagram, is_admin, must_change_password, keep, created_at, avatar_url')
      .order('created_at', { ascending: false }),
    admin.from('products').select('seller_id'),
  ])

  // Paginate through auth.users — confirmed/unconfirmed state lives there.
  const confirmedMap = new Map<string, string | null>()
  let page = 1
  const perPage = 1000
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) break
    for (const u of data.users) confirmedMap.set(u.id, u.email_confirmed_at ?? null)
    if (data.users.length < perPage) break
    page += 1
    if (page > 20) break
  }

  const productCounts: Record<string, number> = {}
  productsRes.data?.forEach((p) => {
    productCounts[p.seller_id] = (productCounts[p.seller_id] || 0) + 1
  })

  // Deliverability: one MX lookup per unique domain. Catches typos like
  // gmial.com instantly without a paid service.
  const domains = Array.from(
    new Set(
      (usersRes.data || [])
        .map((u) => (u.email.split('@')[1] || '').toLowerCase())
        .filter(Boolean)
    )
  )
  const deliverabilityMap = new Map<string, boolean>()
  await Promise.all(
    domains.map(async (d) => {
      deliverabilityMap.set(d, await lookupMxDeliverable(d))
    })
  )

  const users = (usersRes.data || []).map((u) => {
    const domain = (u.email.split('@')[1] || '').toLowerCase()
    return {
      ...u,
      product_count: productCounts[u.id] || 0,
      email_confirmed_at: confirmedMap.get(u.id) ?? null,
      email_deliverable: deliverabilityMap.get(domain) ?? null,
    }
  })

  return NextResponse.json({ users })
}
