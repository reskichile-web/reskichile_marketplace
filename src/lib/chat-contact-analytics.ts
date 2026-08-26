import { sanitizeCampaignAttribution } from '@/lib/campaign-attribution'
import { createServiceRoleClient } from '@/lib/supabase/server'

interface RecordChatContactInput {
  request: Request
  conversationId: string
  senderId: string
  attribution: ReturnType<typeof sanitizeCampaignAttribution>
}

/**
 * Records exactly one qualified internal-chat contact: the buyer's first
 * successfully stored message for a product conversation.
 */
export async function recordFirstBuyerChatContact({
  request,
  conversationId,
  senderId,
  attribution,
}: RecordChatContactInput): Promise<boolean> {
  const admin = createServiceRoleClient()
  const [conversationRes, buyerMessageRes, profileRes] = await Promise.all([
    admin
      .from('conversations')
      .select(`
        id,
        buyer_id,
        product_id,
        products:product_id (id, slug, product_type)
      `)
      .eq('id', conversationId)
      .single(),
    admin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('sender_id', senderId),
    admin
      .from('users')
      .select('is_admin')
      .eq('id', senderId)
      .single(),
  ])

  const conversation = conversationRes.data
  if (
    !conversation ||
    conversation.buyer_id !== senderId ||
    buyerMessageRes.count !== 1 ||
    profileRes.data?.is_admin
  ) {
    return false
  }

  const productRaw = conversation.products as
    | { id: string; slug: string | null; product_type: string | null }
    | { id: string; slug: string | null; product_type: string | null }[]
    | null
  const product = Array.isArray(productRaw) ? productRaw[0] ?? null : productRaw
  if (!product) return false

  const cityRaw = request.headers.get('x-vercel-ip-city')
  let city: string | null = null
  if (cityRaw) {
    try { city = decodeURIComponent(cityRaw) } catch { city = cityRaw }
  }

  const { error } = await admin.from('events').insert({
    event_type: 'click',
    event_name: 'chat_contact',
    path: `/producto/${product.slug || product.id}`,
    category: product.product_type,
    product_id: product.id,
    user_id: senderId,
    referrer: request.headers.get('referer')?.slice(0, 500) || null,
    user_agent: request.headers.get('user-agent')?.slice(0, 300) || null,
    country: request.headers.get('x-vercel-ip-country'),
    city,
    ...(attribution ?? {}),
  })

  if (error) {
    // The partial unique index makes retries and concurrent sends idempotent.
    if (error.code !== '23505') {
      console.error('[chat-message] contact event insert failed:', error.message)
    }
    return false
  }

  return true
}
