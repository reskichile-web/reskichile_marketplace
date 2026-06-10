import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Admin god-mode chat data. READ ONLY by design: this route (and its [id]
// sibling) only SELECTs — it must never touch delivered_at / read_at, so
// admins can inspect chats without leaving receipts.
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

  const [convsRes, messagesRes] = await Promise.all([
    admin
      .from('conversations')
      .select(`
        id, created_at, last_message_at,
        buyer:users!buyer_id(id, name, email),
        seller:users!seller_id(id, name, email),
        products(id, brand, model, slug, product_images(url, order)),
        messages(body, sender_id, created_at, read_at)
      `)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { foreignTable: 'messages', ascending: false })
      .limit(1, { foreignTable: 'messages' })
      .limit(50),
    admin
      .from('messages')
      .select(`
        id, body, created_at, conversation_id, read_at,
        sender:users!sender_id(name),
        conversations(id, buyer_id, seller_id, products(brand, model))
      `)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (convsRes.error || messagesRes.error) {
    return NextResponse.json(
      { error: convsRes.error?.message || messagesRes.error?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    conversations: convsRes.data ?? [],
    recent_messages: messagesRes.data ?? [],
  })
}
