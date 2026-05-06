'use client'

import Link from 'next/link'
import { PRODUCT_TYPES } from '@/lib/constants'

export interface ProductPreview {
  id: string
  brand: string | null
  model: string | null
  price: number
  status: string
  product_type: string
  slug: string | null
  image_url: string | null
}

export interface ConversationPreview {
  id: string
  other_name: string | null
  product_label: string | null
  last_body: string | null
  last_at: string | null
  unread: number
  is_other_last: boolean
  image_url: string | null
}

interface Props {
  profile: {
    email: string
    name: string | null
    phone: string | null
    instagram: string | null
    avatar_url: string | null
  } | null
  products: ProductPreview[]
  productsTotal: number
  conversations: ConversationPreview[]
  conversationsTotal: number
}

export default function DesktopDashboardView({
  profile,
  products,
  productsTotal,
  conversations,
  conversationsTotal,
}: Props) {
  return (
    <div className="max-w-6xl mx-auto px-6 md:px-10 pt-4 md:pt-5 pb-6 h-[calc(100vh-130px)] flex flex-col">
      <h1 className="font-body text-xl xl:text-2xl font-black mb-4 shrink-0">Mi cuenta</h1>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-4 min-h-0">
        {/* Profile card */}
        <div className="lg:col-span-1 lg:row-span-1 bg-white rounded-none border border-gray-200 p-5 flex flex-col overflow-hidden min-h-0">
          <div className="flex items-center gap-3 shrink-0">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.6-4.9-9.8-4.9z" />
                </svg>
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-body font-black text-base truncate">
                {profile?.name || 'Mi perfil'}
              </h2>
              <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
            </div>
          </div>

          <div className="mt-3 space-y-1.5 text-sm shrink-0">
            <DetailRow label="Teléfono" value={profile?.phone || '—'} />
            <DetailRow label="Instagram" value={profile?.instagram ? `@${profile.instagram}` : '—'} />
          </div>

          <div className="mt-auto pt-3 shrink-0">
            <Link
              href="/perfil/editar"
              className="w-full inline-flex items-center justify-center gap-2 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 py-1.5 transition-colors text-sm font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Editar perfil
            </Link>
          </div>
        </div>

        {/* Products card */}
        <div className="lg:col-span-2 bg-white rounded-none border border-gray-200 p-5 flex flex-col overflow-hidden min-h-0">
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
              <Link
                href="/vender"
                className="inline-flex items-center gap-2 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 px-4 py-1.5 transition-colors text-sm font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
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
                  <div className="flex-1 bg-gray-100 overflow-hidden min-h-0">
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
        <div className="lg:col-span-2 bg-white rounded-none border border-gray-200 p-5 flex flex-col overflow-hidden min-h-0">
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
                    className={`flex items-center gap-3 p-3 min-h-[68px] transition-colors ${
                      highlight ? 'bg-brand-400 hover:bg-brand-500 text-white' : 'hover:bg-gray-50'
                    }`}
                  >
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image_url} alt="" className="w-12 h-12 object-cover shrink-0" />
                    ) : (
                      <div className={`w-12 h-12 shrink-0 ${highlight ? 'bg-white/20' : 'bg-gray-100'}`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`text-sm font-medium truncate ${highlight ? 'text-white' : 'text-gray-900'}`}>
                          {c.other_name}
                          {c.product_label && (
                            <span className={highlight ? 'text-white/80' : 'text-gray-400'}> – {c.product_label}</span>
                          )}
                        </p>
                        {c.last_at && (
                          <span className={`text-xs shrink-0 tabular-nums ${highlight ? 'text-white/80' : 'text-gray-400'}`}>
                            {timeAgoShort(c.last_at)}
                          </span>
                        )}
                      </div>
                      {c.last_body ? (
                        <p className={`text-xs truncate mt-0.5 ${highlight ? 'text-white font-bold' : 'text-gray-500'}`}>
                          {highlight && c.unread > 1 ? `+${c.unread} mensajes` : c.last_body}
                        </p>
                      ) : (
                        <p className={`text-xs italic mt-0.5 ${highlight ? 'text-white/60' : 'text-gray-400'}`}>
                          Sin mensajes
                        </p>
                      )}
                    </div>
                    {c.unread > 0 && (
                      <span className="shrink-0 bg-red-500 text-white text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full">
                        {c.unread > 9 ? '9+' : c.unread}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Likes card (placeholder) */}
        <div className="bg-white rounded-none border border-gray-200 p-5 flex flex-col overflow-hidden min-h-0">
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

function timeAgoShort(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'ahora'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)}d`
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}
