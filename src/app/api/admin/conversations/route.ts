import { createServiceRoleClient } from '@/lib/supabase/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-security'
import { adminPageMeta, parseAdminPageParams } from '@/lib/admin-pagination'
import { NextResponse } from 'next/server'

// Admin god-mode chat data. READ ONLY by design: this route (and its [id]
// sibling) only SELECTs — it must never touch delivered_at / read_at, so
// admins can inspect chats without leaving receipts.
export async function GET(request: Request) {
  try {
    await requireAdmin()
    const admin = createServiceRoleClient()
    const searchParams = new URL(request.url).searchParams

    if (searchParams.get('mode') === 'activity') {
      const [messagesRes, whatsappRes] = await Promise.all([
        admin
          .from('messages')
          .select(`
            id, body, created_at, conversation_id, read_at,
            sender:users!sender_id(name),
            conversations(id, buyer_id, seller_id, products(brand, model))
          `)
          .order('created_at', { ascending: false })
          .limit(20),
        admin
          .from('events')
          .select(`
            id, created_at,
            users(name, email),
            products(id, brand, model, slug)
          `)
          .eq('event_type', 'click')
          .eq('event_name', 'whatsapp_contact')
          .order('created_at', { ascending: false })
          .limit(20),
      ])
      if (messagesRes.error || whatsappRes.error) throw new Error('admin activity query failed')
      return NextResponse.json({
        recent_messages: messagesRes.data ?? [],
        recent_whatsapp_clicks: whatsappRes.data ?? [],
      }, { headers: { 'Cache-Control': 'no-store, private' } })
    }

    const { offset, limit } = parseAdminPageParams(searchParams)
    const convsRes = await admin
      .from('conversations')
      .select(`
        id, created_at, last_message_at,
        buyer:users!buyer_id(id, name, email),
        seller:users!seller_id(id, name, email),
        products(id, brand, model, slug, product_images(url, order)),
        messages(body, sender_id, created_at, read_at)
      `, { count: 'exact' })
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { foreignTable: 'messages', ascending: false })
      .limit(1, { foreignTable: 'messages' })
      .range(offset, offset + limit - 1)

    if (convsRes.error) throw new Error('admin conversations query failed')
    const conversations = convsRes.data ?? []
    return NextResponse.json({
      conversations,
      ...adminPageMeta(convsRes.count || 0, offset, conversations.length),
    }, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json(
      { error: known.message, code: known.code },
      { status: known.status, headers: { 'Cache-Control': 'no-store, private' } },
    )
  }
}
