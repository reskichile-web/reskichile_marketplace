import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Full transcript for the admin god-mode viewer. READ ONLY: never updates
// delivered_at / read_at — the participants must not see admin reads.
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

  const [convRes, messagesRes] = await Promise.all([
    admin
      .from('conversations')
      .select(`
        id, created_at, last_message_at, buyer_id, seller_id,
        buyer:users!buyer_id(id, name, email),
        seller:users!seller_id(id, name, email),
        products(id, brand, model, slug, product_images(url, order))
      `)
      .eq('id', id)
      .maybeSingle(),
    admin
      .from('messages')
      .select('id, body, sender_id, created_at, delivered_at, read_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!convRes.data) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

  return NextResponse.json({
    conversation: convRes.data,
    messages: messagesRes.data ?? [],
  })
}
