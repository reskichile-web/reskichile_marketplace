import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { buildChatMessageEmail } from '@/lib/email/templates'

const CHAT_EMAIL_COOLDOWN_MINUTES = 30

function cleanBody(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const payload = await req.json().catch(() => ({}))
  const conversationId = typeof payload.conversation_id === 'string' ? payload.conversation_id : ''
  const requestedId = typeof payload.id === 'string' ? payload.id : undefined
  const body = cleanBody(payload.body)

  if (!conversationId || !body) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const insertPayload = {
    ...(requestedId ? { id: requestedId } : {}),
    conversation_id: conversationId,
    sender_id: user.id,
    body,
  }

  const { data: message, error: insertError } = await supabase
    .from('messages')
    .insert(insertPayload)
    .select('id, conversation_id, sender_id, body, created_at')
    .single()

  if (insertError || !message) {
    return NextResponse.json({ error: insertError?.message || 'No se pudo enviar' }, { status: 500 })
  }

  await notifyRecipient(message.id, conversationId, user.id, body).catch((e) => {
    console.error('[chat-message] notification failed:', e instanceof Error ? e.message : e)
  })

  return NextResponse.json({ message })
}

async function notifyRecipient(
  messageId: string,
  conversationId: string,
  senderId: string,
  body: string,
) {
  const admin = createServiceRoleClient()

  const { data: conversation } = await admin
    .from('conversations')
    .select(`
      id,
      product_id,
      buyer_id,
      seller_id,
      products:product_id (
        id,
        brand,
        model,
        slug,
        product_images (url, order)
      )
    `)
    .eq('id', conversationId)
    .single()

  if (!conversation) return

  const recipientId = conversation.buyer_id === senderId
    ? conversation.seller_id
    : conversation.seller_id === senderId
      ? conversation.buyer_id
      : null
  if (!recipientId) return

  const [recipientRes, senderRes, unreadRes, notifRes] = await Promise.all([
    admin
      .from('users')
      .select('id, email, name, notify_chat_email')
      .eq('id', recipientId)
      .single(),
    admin
      .from('users')
      .select('id, name, email')
      .eq('id', senderId)
      .single(),
    admin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', recipientId)
      .is('read_at', null),
    admin
      .from('chat_email_notifications')
      .select('last_sent_at')
      .eq('conversation_id', conversationId)
      .eq('recipient_id', recipientId)
      .maybeSingle(),
  ])

  const recipient = recipientRes.data
  if (!recipient?.email || recipient.notify_chat_email === false) return

  // If more than the just-created message is unread, a previous email already
  // covered the conversation burst.
  if ((unreadRes.count ?? 0) > 1) return

  const lastSentAt = notifRes.data?.last_sent_at ? new Date(notifRes.data.last_sent_at).getTime() : 0
  const cooldownMs = CHAT_EMAIL_COOLDOWN_MINUTES * 60 * 1000
  if (lastSentAt && Date.now() - lastSentAt < cooldownMs) return

  const productRaw = conversation.products as
    | {
        brand: string | null
        model: string | null
        product_images: { url: string; order: number }[] | null
      }
    | {
        brand: string | null
        model: string | null
        product_images: { url: string; order: number }[] | null
      }[]
    | null
  const product = Array.isArray(productRaw) ? productRaw[0] ?? null : productRaw
  const productTitle = product
    ? [product.brand, product.model].filter(Boolean).join(' ').trim() || null
    : null
  const imageUrl = product?.product_images
    ?.slice()
    .sort((a, b) => a.order - b.order)[0]?.url ?? null

  const { subject, html, text } = buildChatMessageEmail({
    conversationId,
    senderName: senderRes.data?.name || senderRes.data?.email || null,
    recipientName: recipient.name,
    messageBody: body,
    productTitle,
    productImageUrl: imageUrl,
  })

  const result = await sendEmail({ to: recipient.email, subject, html, text })
  if (!result.ok) {
    console.error('[chat-message] email failed:', result.error)
    return
  }

  const { error: upsertError } = await admin
    .from('chat_email_notifications')
    .upsert({
      conversation_id: conversationId,
      recipient_id: recipientId,
      last_message_id: messageId,
      last_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'conversation_id,recipient_id' })

  if (upsertError) {
    console.error('[chat-message] notification log failed:', upsertError.message)
  }
}
