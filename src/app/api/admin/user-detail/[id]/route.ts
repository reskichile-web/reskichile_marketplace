import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const [authRes, productsRes, convsRes, invitesRes] = await Promise.all([
    admin.auth.admin.getUserById(id),
    admin
      .from('products')
      .select('id, brand, model, status, price, sale_price, slug, created_at, product_type, product_images(url, order)')
      .eq('seller_id', id)
      .order('created_at', { ascending: false }),
    admin
      .from('conversations')
      .select('id, created_at, last_message_at, buyer:users!buyer_id(name), seller:users!seller_id(name), products(id, brand, model, slug, product_type, product_images(url, order))')
      .or(`buyer_id.eq.${id},seller_id.eq.${id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(20),
    admin
      .from('password_invites')
      .select('slug, expires_at, used_at, created_at, opened_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
  ])

  const authUser = authRes.data?.user
  const auth = authUser
    ? {
        last_sign_in_at: authUser.last_sign_in_at ?? null,
        email_confirmed_at: authUser.email_confirmed_at ?? null,
        created_at: authUser.created_at ?? null,
      }
    : null

  return NextResponse.json({
    auth,
    products: productsRes.data ?? [],
    conversations: convsRes.data ?? [],
    invites: invitesRes.data ?? [],
  })
}
