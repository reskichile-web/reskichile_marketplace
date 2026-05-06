'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_TYPES } from '@/lib/constants'
import PerfilSkeleton from '@/components/skeletons/PerfilSkeleton'

interface ProductPreview {
  id: string
  brand: string | null
  model: string | null
  price: number
  status: string
  product_type: string
  slug: string | null
  image_url: string | null
}

interface ConversationPreview {
  id: string
  other_name: string | null
  product_label: string | null
  last_body: string | null
  last_at: string | null
  unread: number
  is_other_last: boolean
  image_url: string | null
}

export default function DesktopDashboard() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<{
    id: string
    email: string
    name: string | null
    phone: string | null
    instagram: string | null
    avatar_url: string | null
  } | null>(null)
  const [products, setProducts] = useState<ProductPreview[]>([])
  const [productsTotal, setProductsTotal] = useState(0)
  const [conversations, setConversations] = useState<ConversationPreview[]>([])
  const [conversationsTotal, setConversationsTotal] = useState(0)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [profileRes, productsRes, convRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', user.id).single(),
        supabase
          .from('products')
          .select('id, brand, model, price, status, product_type, slug, product_images(url, order)')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('conversations')
          .select('*')
          .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
          .order('last_message_at', { ascending: false }),
      ])

      if (profileRes.data) {
        setProfile({
          id: profileRes.data.id,
          email: user.email ?? '',
          name: profileRes.data.name,
          phone: profileRes.data.phone,
          instagram: profileRes.data.instagram,
          avatar_url: profileRes.data.avatar_url,
        })
      }

      const allProducts = (productsRes.data || []).map((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sorted = ((p as any).product_images || []).sort(
          (a: { order: number }, b: { order: number }) => a.order - b.order
        )
        return {
          id: p.id,
          brand: p.brand,
          model: p.model,
          price: p.price,
          status: p.status,
          product_type: p.product_type,
          slug: p.slug,
          image_url: sorted[0]?.url || null,
        }
      })
      setProducts(allProducts.slice(0, 4))
      setProductsTotal(allProducts.length)

      const allConvs = convRes.data || []
      setConversationsTotal(allConvs.length)

      if (allConvs.length > 0) {
        const productIds = Array.from(
          new Set(allConvs.map((c) => c.product_id).filter(Boolean))
        ) as string[]
        const otherIds = Array.from(
          new Set(allConvs.map((c) => (c.buyer_id === user.id ? c.seller_id : c.buyer_id)))
        )
        const [pRes, uRes, mRes, unRes] = await Promise.all([
          productIds.length
            ? supabase
                .from('products')
                .select('id, brand, model, product_images(url, order)')
                .in('id', productIds)
            : Promise.resolve({ data: [] }),
          supabase.from('users').select('id, name').in('id', otherIds),
          supabase
            .from('messages')
            .select('conversation_id, body, sender_id, created_at')
            .in('conversation_id', allConvs.map((c) => c.id))
            .order('created_at', { ascending: false }),
          supabase
            .from('messages')
            .select('conversation_id, sender_id')
            .in('conversation_id', allConvs.map((c) => c.id))
            .is('read_at', null)
            .neq('sender_id', user.id),
        ])

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const productMap = new Map<string, any>()
        ;(pRes.data || []).forEach((p) => productMap.set(p.id, p))
        const userMap = new Map<string, { id: string; name: string | null }>()
        ;(uRes.data || []).forEach((u) => userMap.set(u.id, u))
        const lastBy = new Map<string, { body: string; sender_id: string; created_at: string }>()
        for (const m of mRes.data || []) {
          if (!lastBy.has(m.conversation_id)) {
            lastBy.set(m.conversation_id, m)
          }
        }
        const unreadBy = new Map<string, number>()
        for (const m of unRes.data || []) {
          unreadBy.set(m.conversation_id, (unreadBy.get(m.conversation_id) || 0) + 1)
        }

        const previews: ConversationPreview[] = allConvs.slice(0, 4).map((c) => {
          const otherId = c.buyer_id === user.id ? c.seller_id : c.buyer_id
          const other = userMap.get(otherId)
          const product = c.product_id ? productMap.get(c.product_id) : null
          const last = lastBy.get(c.id)
          const sorted =
            product?.product_images?.sort(
              (a: { order: number }, b: { order: number }) => a.order - b.order
            ) || []
          return {
            id: c.id,
            other_name: other?.name || 'Usuario',
            product_label: product
              ? [product.brand, product.model].filter(Boolean).join(' ')
              : null,
            last_body: last?.body || null,
            last_at: last?.created_at || c.last_message_at,
            unread: unreadBy.get(c.id) || 0,
            is_other_last: !!last && last.sender_id !== user.id,
            image_url: sorted[0]?.url || null,
          }
        })
        setConversations(previews)
      }

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <PerfilSkeleton />

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pt-2 md:pt-3 pb-4 h-[calc(100vh-130px)] flex flex-col">
      <h1 className="font-body text-xl xl:text-2xl font-black mb-3 shrink-0">Mi cuenta</h1>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-4 min-h-0">
        {/* Profile card — spans 1 col, both rows */}
        <div className="lg:col-span-1 lg:row-span-2 bg-white rounded-2xl border border-gray-200 p-5 flex flex-col overflow-hidden">
          <div className="flex items-center gap-4">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.6-4.9-9.8-4.9z" />
                </svg>
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-body font-black text-lg truncate">
                {profile?.name || 'Mi perfil'}
              </h2>
              <p className="text-sm text-gray-500 truncate">{profile?.email}</p>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm">
            <DetailRow label="Teléfono" value={profile?.phone || '—'} />
            <DetailRow label="Instagram" value={profile?.instagram ? `@${profile.instagram}` : '—'} />
          </div>

          <Link
            href="/perfil/editar"
            className="mt-auto pt-6 inline-flex items-center justify-center gap-2 bg-brand-500 text-white py-2.5 rounded-lg hover:bg-brand-600 transition-colors font-medium text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Editar perfil
          </Link>
        </div>

        {/* Products card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 flex flex-col overflow-hidden min-h-0">
          <div className="flex items-baseline justify-between mb-3 shrink-0">
            <h2 className="font-body font-black text-lg">
              Mis productos
              <span className="ml-2 text-sm font-normal text-gray-400">{productsTotal}</span>
            </h2>
            <Link href="/mis-productos" className="text-xs uppercase tracking-widest font-bold text-brand-500 hover:text-brand-600">
              Ver todos →
            </Link>
          </div>
          {products.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <p className="text-sm text-gray-500 mb-3">Aún no has publicado nada.</p>
              <Link href="/vender" className="inline-block bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600">
                Publicar primer producto
              </Link>
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 min-h-0">
              {products.map((p) => (
                <Link
                  key={p.id}
                  href={`/producto/${p.slug || p.id}`}
                  className="group flex flex-col min-h-0"
                >
                  <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden min-h-0">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[10px] tracking-widest uppercase text-gray-400 font-bold leading-tight">
                    {PRODUCT_TYPES[p.product_type]}
                  </p>
                  <p className="text-xs font-medium truncate">
                    {[p.brand, p.model].filter(Boolean).join(' ')}
                  </p>
                  <p className="text-xs font-bold">${p.price.toLocaleString('es-CL')}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Conversations card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col overflow-hidden min-h-0">
          <div className="flex items-baseline justify-between mb-3 shrink-0">
            <h2 className="font-body font-black text-lg">
              Mensajes
              <span className="ml-2 text-sm font-normal text-gray-400">{conversationsTotal}</span>
            </h2>
            <Link href="/mensajes" className="text-xs uppercase tracking-widest font-bold text-brand-500 hover:text-brand-600">
              Ver todos →
            </Link>
          </div>
          {conversations.length === 0 ? (
            <p className="flex-1 text-sm text-gray-500 text-center flex items-center justify-center">Sin conversaciones todavía.</p>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {conversations.map((c) => {
                const highlight = c.is_other_last && c.unread > 0
                return (
                  <Link
                    key={c.id}
                    href={`/mensajes/${c.id}`}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                      highlight ? 'bg-brand-400 hover:bg-brand-500 text-white' : 'hover:bg-gray-50'
                    }`}
                  >
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image_url} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                    ) : (
                      <div className={`w-9 h-9 rounded shrink-0 ${highlight ? 'bg-white/20' : 'bg-gray-100'}`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${highlight ? 'text-white' : 'text-gray-900'}`}>
                        {c.other_name}
                        {c.product_label && (
                          <span className={highlight ? 'text-white/80' : 'text-gray-400'}> – {c.product_label}</span>
                        )}
                      </p>
                      {c.last_body && (
                        <p className={`text-xs truncate ${highlight ? 'text-white font-bold' : 'text-gray-500'}`}>
                          {highlight && c.unread > 1 ? `+${c.unread} mensajes` : c.last_body}
                        </p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Likes card (placeholder) */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col overflow-hidden min-h-0">
          <div className="flex items-baseline justify-between mb-3 shrink-0">
            <h2 className="font-body font-black text-lg">Me gusta</h2>
            <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Próximamente</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <svg className="w-8 h-8 text-gray-300 mb-1.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <p className="text-xs text-gray-500">
              Pronto vas a poder marcar favoritos.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">{label}</p>
      <p className="text-sm text-gray-900 truncate">{value}</p>
    </div>
  )
}
