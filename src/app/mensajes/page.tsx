import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PRODUCT_TYPES } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Mensajes - ReskiChile',
}

export const dynamic = 'force-dynamic'

interface ConvRow {
  id: string
  product_id: string | null
  buyer_id: string
  seller_id: string
  last_message_at: string
  created_at: string
}

export default async function MensajesPage() {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: convs } = await supabase
    .from('conversations')
    .select('*')
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order('last_message_at', { ascending: false })

  const conversations = (convs || []) as ConvRow[]
  if (conversations.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-5 md:px-10 pt-8 pb-24">
        <h1 className="font-body font-black text-3xl md:text-4xl text-brand-400">Mensajes</h1>
        <p className="mt-4 text-gray-500">Aún no has iniciado ninguna conversación.</p>
      </div>
    )
  }

  const productIds = Array.from(new Set(conversations.map((c) => c.product_id).filter(Boolean))) as string[]
  const otherIds = Array.from(
    new Set(conversations.map((c) => (c.buyer_id === user.id ? c.seller_id : c.buyer_id)))
  )

  const [productsRes, usersRes, lastMessagesRes, unreadRes] = await Promise.all([
    productIds.length
      ? supabase
          .from('products')
          .select('id, brand, model, slug, product_type, price, product_images(url, order)')
          .in('id', productIds)
      : Promise.resolve({ data: [] }),
    supabase.from('users').select('id, name, avatar_url').in('id', otherIds),
    supabase
      .from('messages')
      .select('conversation_id, body, sender_id, created_at')
      .in('conversation_id', conversations.map((c) => c.id))
      .order('created_at', { ascending: false }),
    supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', conversations.map((c) => c.id))
      .is('read_at', null)
      .neq('sender_id', user.id),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productMap = new Map<string, any>()
  ;(productsRes.data || []).forEach((p) => productMap.set(p.id, p))
  const userMap = new Map<string, { id: string; name: string | null; avatar_url: string | null }>()
  ;(usersRes.data || []).forEach((u) => userMap.set(u.id, u))

  // Last message per conversation: take the first one for each (already DESC)
  const lastByConv = new Map<string, { body: string; sender_id: string; created_at: string }>()
  for (const m of lastMessagesRes.data || []) {
    if (!lastByConv.has(m.conversation_id)) {
      lastByConv.set(m.conversation_id, {
        body: m.body,
        sender_id: m.sender_id,
        created_at: m.created_at,
      })
    }
  }

  const unreadByConv = new Map<string, number>()
  for (const m of unreadRes.data || []) {
    unreadByConv.set(m.conversation_id, (unreadByConv.get(m.conversation_id) || 0) + 1)
  }

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-10 pt-6 md:pt-8 pb-24">
      <h1 className="font-body font-black text-3xl md:text-4xl text-brand-400 mb-6">Mensajes</h1>

      <div className="divide-y divide-gray-200">
        {conversations.map((c) => {
          const product = c.product_id ? productMap.get(c.product_id) : null
          const otherId = c.buyer_id === user.id ? c.seller_id : c.buyer_id
          const other = userMap.get(otherId)
          const last = lastByConv.get(c.id)
          const unread = unreadByConv.get(c.id) || 0
          const productImage =
            product?.product_images?.sort(
              (a: { order: number }, b: { order: number }) => a.order - b.order
            )[0]?.url

          return (
            <Link
              key={c.id}
              href={`/mensajes/${c.id}`}
              className="flex items-center gap-3 py-4 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors"
            >
              {productImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={productImage}
                  alt=""
                  className="w-14 h-14 rounded-md object-cover bg-gray-100 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-md bg-gray-100 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="font-body font-semibold text-sm truncate">
                    {other?.name || 'Usuario'}
                  </p>
                  <p className="text-xs text-gray-400 shrink-0">
                    {last && timeAgo(last.created_at)}
                  </p>
                </div>
                {product && (
                  <p className="text-xs text-gray-400 truncate">
                    {PRODUCT_TYPES[product.product_type]}: {[product.brand, product.model].filter(Boolean).join(' ')}
                  </p>
                )}
                {last && (
                  <p
                    className={`text-sm truncate mt-0.5 ${
                      unread > 0 ? 'text-black font-medium' : 'text-gray-500'
                    }`}
                  >
                    {last.sender_id === user.id ? 'Tú: ' : ''}
                    {last.body}
                  </p>
                )}
              </div>
              {unread > 0 && (
                <span className="bg-brand-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                  {unread}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function timeAgo(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'ahora'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)}d`
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}
