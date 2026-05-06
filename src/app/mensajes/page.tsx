import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import EmptyState from '@/components/illustrations/EmptyState'

export const metadata: Metadata = {
  title: 'Mis mensajes - ReskiChile',
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
      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-10 md:pt-14 pb-20">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-10">
          <h1 className="font-body text-3xl font-black mb-8">Mis mensajes</h1>
          <EmptyState
            title="Aún no tienes conversaciones"
            description="Cuando contactes a un vendedor por chat, las conversaciones aparecerán acá."
            actionLabel="Ir al catálogo"
            actionHref="/catalogo"
          />
        </div>
      </div>
    )
  }

  const productIds = Array.from(
    new Set(conversations.map((c) => c.product_id).filter(Boolean))
  ) as string[]
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
      .in(
        'conversation_id',
        conversations.map((c) => c.id)
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('messages')
      .select('conversation_id')
      .in(
        'conversation_id',
        conversations.map((c) => c.id)
      )
      .is('read_at', null)
      .neq('sender_id', user.id),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productMap = new Map<string, any>()
  ;(productsRes.data || []).forEach((p) => productMap.set(p.id, p))
  const userMap = new Map<string, { id: string; name: string | null; avatar_url: string | null }>()
  ;(usersRes.data || []).forEach((u) => userMap.set(u.id, u))

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
    <div className="max-w-4xl mx-auto px-4 min-h-screen pt-10 md:pt-14 pb-20">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-10">
        <h1 className="font-body text-3xl font-black mb-8">Mis mensajes</h1>

        <div className="space-y-4">
          {conversations.map((c) => {
            const product = c.product_id ? productMap.get(c.product_id) : null
            const otherId = c.buyer_id === user.id ? c.seller_id : c.buyer_id
            const other = userMap.get(otherId)
            const last = lastByConv.get(c.id)
            const unread = unreadByConv.get(c.id) || 0
            const isOtherLast = last && last.sender_id !== user.id
            const highlight = !!last && isOtherLast && unread > 0

            const productImage = product?.product_images?.sort(
              (a: { order: number }, b: { order: number }) => a.order - b.order
            )[0]?.url

            const productLabel = product
              ? [product.brand, product.model].filter(Boolean).join(' ')
              : 'Producto'
            const otherName = other?.name || 'Usuario'
            const title = `${otherName} – ${productLabel}`

            // Preview body — bold/white when unread
            let preview: React.ReactNode = null
            if (last) {
              if (highlight && unread === 1) {
                preview = (
                  <p className="text-sm font-bold text-white truncate mt-1">{last.body}</p>
                )
              } else if (highlight && unread > 1) {
                preview = (
                  <p className="text-sm font-bold text-white truncate mt-1">+{unread} mensajes</p>
                )
              } else {
                preview = (
                  <p className="text-sm text-gray-500 truncate mt-1">
                    {last.sender_id === user.id ? 'Tú: ' : ''}
                    {last.body}
                  </p>
                )
              }
            }

            return (
              <Link
                key={c.id}
                href={`/mensajes/${c.id}`}
                className={`relative block border p-5 min-h-[110px] transition-colors ${
                  highlight
                    ? 'bg-brand-400 border-brand-400 hover:bg-brand-500'
                    : 'bg-white border-gray-200 hover:border-brand-300'
                }`}
              >
                <div className="flex gap-4 h-full">
                  {productImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={productImage}
                      alt={productLabel}
                      className="w-20 h-20 sm:w-24 sm:h-24 object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className={`w-20 h-20 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center ${
                        highlight ? 'bg-white/20' : 'bg-gray-100'
                      }`}
                    >
                      <svg
                        className={`w-8 h-8 ${highlight ? 'text-white/70' : 'text-gray-300'}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z"
                        />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2
                        className={`font-body font-medium truncate ${
                          highlight ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {title}
                      </h2>
                      <span
                        className={`text-xs shrink-0 tabular-nums ${
                          highlight ? 'text-white/80' : 'text-gray-400'
                        }`}
                      >
                        {timeAgo(c.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 min-w-0">{preview}</div>
                      {unread > 0 && (
                        <span className="shrink-0 bg-red-500 text-white text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                          {unread > 9 ? '9+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function timeAgo(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'ahora'
  if (diff < 3600_000) return `hace ${Math.floor(diff / 60_000)} min`
  if (diff < 86400_000) return `hace ${Math.floor(diff / 3600_000)} h`
  if (diff < 7 * 86400_000) return `hace ${Math.floor(diff / 86400_000)} d`
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}
