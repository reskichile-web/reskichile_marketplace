'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type {
  AdminRecentMessage,
  AdminRecentRackCartEvent,
  AdminRecentRackOrder,
  AdminRecentWhatsappClick,
} from '@/lib/admin-view-data'
import { parseRackEventDetail } from '@/lib/rack-analytics'
import { getSkiRackProduct } from '@/lib/ski-rack-products'

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `hace ${hrs} h`
  return `hace ${Math.floor(hrs / 24)} d`
}

/**
 * Important commercial activity across conversations, contacts and Ski Rack.
 */
export default function RecentMessagesCard({
  className,
  initialMessages,
  initialWhatsappClicks,
  initialRackCartEvents,
  initialRackOrders,
}: {
  className?: string
  initialMessages?: AdminRecentMessage[]
  initialWhatsappClicks?: AdminRecentWhatsappClick[]
  initialRackCartEvents?: AdminRecentRackCartEvent[]
  initialRackOrders?: AdminRecentRackOrder[]
}) {
  const hasInitialData = initialMessages !== undefined
    && initialWhatsappClicks !== undefined
    && initialRackCartEvents !== undefined
    && initialRackOrders !== undefined
  const [messages, setMessages] = useState<AdminRecentMessage[]>(initialMessages || [])
  const [whatsappClicks, setWhatsappClicks] = useState<AdminRecentWhatsappClick[]>(initialWhatsappClicks || [])
  const [rackCartEvents] = useState<AdminRecentRackCartEvent[]>(initialRackCartEvents || [])
  const [rackOrders] = useState<AdminRecentRackOrder[]>(initialRackOrders || [])
  const [loading, setLoading] = useState(!hasInitialData)

  useEffect(() => {
    if (hasInitialData) return
    async function load() {
      try {
        const res = await fetch('/api/admin/conversations?mode=activity')
        const data = await res.json()
        if (res.ok) {
          setMessages(data.recent_messages || [])
          setWhatsappClicks(data.recent_whatsapp_clicks || [])
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [hasInitialData])

  const activity = [
    ...messages.map(message => ({ kind: 'message' as const, createdAt: message.created_at, message })),
    ...whatsappClicks.map(click => ({ kind: 'whatsapp' as const, createdAt: click.created_at, click })),
    ...rackCartEvents.map(event => ({ kind: 'rack-cart' as const, createdAt: event.created_at, event })),
    ...rackOrders.map(order => ({
      kind: 'rack-purchase' as const,
      createdAt: order.paid_at || order.created_at,
      order,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30)

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className || ''}`}>
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="font-body text-lg font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-900 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            Eventos importantes
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Chats, contactos, carritos y compras de Ski Rack</p>
        </div>
        <Link href="/admin/metricas" className="text-xs text-brand-500 hover:underline shrink-0">
          Ver métricas
        </Link>
      </div>

      {loading ? (
        <p className="px-5 py-8 text-xs text-gray-400 text-center">Cargando…</p>
      ) : activity.length === 0 ? (
        <p className="px-5 py-8 text-sm text-gray-400 text-center">Sin eventos importantes todavía.</p>
      ) : (
        <ul className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
          {activity.map(item => {
            if (item.kind === 'rack-purchase') {
              const { order } = item
              const units = order.order_items.reduce((total, orderItem) => total + Number(orderItem.quantity), 0)
              const names = Array.from(new Set(order.order_items.map(orderItem => orderItem.product_name))).join(', ')
              return (
                <li key={`rack-purchase-${order.public_id}`} className="border-l-4 border-brand-500 bg-brand-50/70 transition-colors hover:bg-brand-100/70">
                  <Link
                    href={`/api/admin/orders/${order.public_id}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-500 px-2 py-1 text-[10px] font-black leading-none tracking-wide text-white">
                          COMPRA RACK
                        </span>
                        <p className="truncate text-sm font-bold text-brand-900">{order.buyer_name || order.buyer_email}</p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-brand-700">{timeAgo(item.createdAt)}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-brand-800">
                      {order.order_number} · {units} {units === 1 ? 'unidad' : 'unidades'} · <span className="font-black">{money.format(order.total_clp)}</span>
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-brand-700/80">{names}</p>
                  </Link>
                </li>
              )
            }

            if (item.kind === 'rack-cart') {
              const { event } = item
              const detail = parseRackEventDetail(event.category)
              const product = detail.slug ? getSkiRackProduct(detail.slug) : null
              const quantity = Number(detail.qty || 1)
              const location = [event.city, event.country].filter(Boolean).join(', ')
              return (
                <li key={`rack-cart-${event.id}`} className="border-l-4 border-amber-400 bg-amber-50/60 transition-colors hover:bg-amber-100/70">
                  <Link href={detail.slug ? `/ski-rack/${detail.slug}` : '/ski-rack'} target="_blank" rel="noopener noreferrer" className="block px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex shrink-0 rounded-full bg-amber-500 px-2 py-1 text-[10px] font-black leading-none tracking-wide text-white">
                          CARRITO
                        </span>
                        <p className="truncate text-sm font-bold text-amber-950">
                          Visitante {event.visitor_id ? `#${event.visitor_id.slice(-6)}` : 'anónimo'}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-amber-700">{timeAgo(event.created_at)}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-amber-800">
                      Agregó {quantity}× <span className="font-bold">{product?.name || detail.slug || 'Ski Rack'}</span>
                      {detail.size ? ` · talla ${detail.size}` : ''}
                      {location ? ` · ${location}` : ''}
                    </p>
                  </Link>
                </li>
              )
            }

            if (item.kind === 'whatsapp') {
              const { click } = item
              const product = [click.products?.brand, click.products?.model]
                .filter(Boolean).join(' ') || 'Producto eliminado'
              const who = click.users?.name || click.users?.email || 'Visitante sin cuenta'
              const href = click.products
                ? `/producto/${click.products.slug || click.products.id}`
                : '/admin/publicaciones'
              return (
                <li key={`whatsapp-${click.id}`} className="bg-green-50/80 border-l-4 border-green-500 hover:bg-green-100/80 transition-colors">
                  <Link
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-1 text-[10px] leading-none font-black tracking-wide text-white shrink-0">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.592-.838-6.313-2.234l-.44-.362-3.09 1.036 1.036-3.09-.362-.44A9.958 9.958 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
                          </svg>
                          WHATSAPP
                        </span>
                        <p className="text-sm font-bold text-green-950 truncate">{who}</p>
                      </div>
                      <span className="text-xs font-medium text-green-700 shrink-0">{timeAgo(click.created_at)}</span>
                    </div>
                    <p className="text-xs text-green-800 mt-1 truncate">
                      Continuó a WhatsApp por <span className="font-bold">{product}</span>
                    </p>
                  </Link>
                </li>
              )
            }

            const m = item.message
            const product = [m.conversations?.products?.brand, m.conversations?.products?.model]
              .filter(Boolean).join(' ') || 'Producto eliminado'
            return (
              <li key={`message-${m.id}`}>
                <Link
                  href={`/admin/chats?c=${m.conversation_id}`}
                  className="block px-5 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {m.sender?.name || 'Anónimo'}
                      <span className="ml-1.5 text-xs font-normal text-gray-400">{product}</span>
                    </p>
                    <span className="text-xs text-gray-400 shrink-0 flex items-center gap-1">
                      {!m.read_at && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" title="No leído" />}
                      {timeAgo(m.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{m.body}</p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
