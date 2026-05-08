import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import ChatRoom from '@/components/chat/ChatRoom'
import { PRODUCT_TYPES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export default async function ChatPage({ params }: Props) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: conv } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', params.id)
    .single()
  if (!conv) notFound()
  if (conv.buyer_id !== user.id && conv.seller_id !== user.id) notFound()

  const otherId = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id

  // Mark as delivered + read for any incoming message that wasn't yet, BEFORE
  // fetching messages so the initial render shows the correct receipt state
  // and avoids a "Entregado → Visto" flicker for the other side.
  const now = new Date().toISOString()
  await supabase
    .from('messages')
    .update({ delivered_at: now, read_at: now })
    .eq('conversation_id', params.id)
    .neq('sender_id', user.id)
    .is('read_at', null)

  const [messagesRes, otherRes, productRes] = await Promise.all([
    // Fetch the 100 MOST RECENT messages (DESC + reverse) so the chat opens
    // at the bottom showing the latest conversation state.
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', params.id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('users').select('id, name, avatar_url').eq('id', otherId).single(),
    conv.product_id
      ? supabase
          .from('products')
          .select('id, brand, model, slug, product_type, price, product_images(url, order)')
          .eq('id', conv.product_id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const initialMessages = (messagesRes.data || []).slice().reverse()
  const other = otherRes.data
  const product = productRes.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productImage = (product as any)?.product_images?.sort(
    (a: { order: number }, b: { order: number }) => a.order - b.order
  )[0]?.url

  return (
    <div className="flex flex-col h-[100dvh] md:h-[calc(100vh-130px)] max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white">
        <Link
          href="/mensajes"
          aria-label="Volver"
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-body font-semibold text-sm truncate">{other?.name || 'Usuario'}</p>
          {product && (
            <Link
              href={`/producto/${product.slug || product.id}`}
              className="text-xs text-gray-500 hover:text-gray-800 truncate block"
            >
              {PRODUCT_TYPES[product.product_type]}: {[product.brand, product.model].filter(Boolean).join(' ')} · ${product.price?.toLocaleString('es-CL')}
            </Link>
          )}
        </div>
        {productImage && (
          <Link href={`/producto/${product?.slug || product?.id}`} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={productImage} alt="" className="w-10 h-10 rounded-md object-cover bg-gray-100" />
          </Link>
        )}
      </div>

      {/* Chat */}
      <ChatRoom
        conversationId={params.id}
        myId={user.id}
        initialMessages={initialMessages}
      />
    </div>
  )
}
