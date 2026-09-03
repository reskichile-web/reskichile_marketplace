'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Mail,
  MapPin,
  Package,
  PackageOpen,
  Phone,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  TriangleAlert,
  Truck,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import AdminInfiniteScroll from '@/components/admin/AdminInfiniteScroll'

interface OrderItem {
  id: string
  product_name: string
  sku: string | null
  unit_price_clp: number
  quantity: number
  line_total_clp: number
}

interface Refund {
  id: string
  amount_clp: number
  state: string
  reason: string
  provider_type: string | null
  response_code: number | null
  created_at: string
}

interface Order {
  public_id: string
  order_number: string
  buyer_email: string
  buyer_name: string
  buyer_phone: string
  delivery_method: 'home' | 'pickup'
  shipping_snapshot: Record<string, string | null>
  order_status: string
  payment_status: string
  fulfillment_status: string
  subtotal_clp: number
  discount_clp: number
  shipping_clp: number
  total_clp: number
  shipping_carrier: string | null
  tracking_number: string | null
  tracking_url: string | null
  shipped_at: string | null
  ready_for_pickup_at: string | null
  paid_at: string | null
  created_at: string
  order_items: OrderItem[]
  refunds: Refund[]
  refundable_clp: number
  has_open_refund: boolean
}

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  authorized: 'Pagado',
  rejected: 'Rechazado',
  aborted: 'Abortado',
  expired: 'Expirado',
  initialization_failed: 'Error de inicio',
  partially_refunded: 'Reembolso parcial',
  refunded: 'Reembolsado',
  reconciliation_required: 'Requiere conciliación',
  preparing: 'Preparando',
  ready_for_pickup: 'Listo para retiro',
  shipped: 'Despachado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  unfulfilled: 'Sin preparar',
}

const FULFILLMENT_STATUS_LABELS: Record<string, string> = {
  unfulfilled: 'Sin preparar',
  pending: 'Por preparar',
  preparing: 'Preparando',
  ready_for_pickup: 'Listo para retiro',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

const PICKUP_POINT_LABELS: Record<string, string> = {
  las_condes: 'Retiro en Las Condes',
  los_angeles: 'Retiro en Los Ángeles',
}

function pickupPointLabel(pointId: string): string {
  return PICKUP_POINT_LABELS[pointId] || 'Punto de retiro ReSkiChile'
}

interface StatusAppearance {
  className: string
  iconClassName: string
  icon: LucideIcon
}

interface PaymentStatusAppearance {
  className: string
  icon: LucideIcon
}

const PAYMENT_STATUS_APPEARANCE: Record<string, PaymentStatusAppearance> = {
  pending: {
    className: 'text-amber-600',
    icon: Clock3,
  },
  authorized: {
    className: 'text-emerald-600',
    icon: Check,
  },
  rejected: {
    className: 'text-red-600',
    icon: X,
  },
  aborted: {
    className: 'text-rose-600',
    icon: X,
  },
  expired: {
    className: 'text-orange-500',
    icon: Clock3,
  },
  initialization_failed: {
    className: 'text-slate-600',
    icon: X,
  },
  partially_refunded: {
    className: 'text-violet-600',
    icon: RotateCcw,
  },
  refunded: {
    className: 'text-indigo-600',
    icon: RotateCcw,
  },
  reconciliation_required: {
    className: 'text-orange-600',
    icon: TriangleAlert,
  },
}

const FULFILLMENT_STATUS_APPEARANCE: Record<string, StatusAppearance> = {
  unfulfilled: {
    className: 'bg-slate-600',
    iconClassName: 'bg-black/20',
    icon: PackageOpen,
  },
  pending: {
    className: 'bg-amber-500',
    iconClassName: 'bg-amber-700/35',
    icon: Clock3,
  },
  preparing: {
    className: 'bg-blue-600',
    iconClassName: 'bg-blue-800/35',
    icon: Package,
  },
  ready_for_pickup: {
    className: 'bg-violet-600',
    iconClassName: 'bg-violet-800/35',
    icon: MapPin,
  },
  shipped: {
    className: 'bg-brand-400',
    iconClassName: 'bg-brand-600/35',
    icon: Truck,
  },
  delivered: {
    className: 'bg-emerald-600',
    iconClassName: 'bg-emerald-800/35',
    icon: Check,
  },
  cancelled: {
    className: 'bg-red-600',
    iconClassName: 'bg-red-800/35',
    icon: X,
  },
}

const FALLBACK_STATUS_APPEARANCE: StatusAppearance = {
  className: 'bg-slate-700',
  iconClassName: 'bg-black/20',
  icon: CircleAlert,
}

const FALLBACK_PAYMENT_STATUS_APPEARANCE: PaymentStatusAppearance = {
  className: 'text-slate-600',
  icon: CircleAlert,
}

function PaymentStatus({
  label,
  appearance,
}: {
  label: string
  appearance: PaymentStatusAppearance
}) {
  const Icon = appearance.icon

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold ${appearance.className}`}>
      <span>{label}</span>
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
    </span>
  )
}

function StatusPill({
  label,
  appearance,
}: {
  label: string
  appearance: StatusAppearance
}) {
  const Icon = appearance.icon

  return (
    <span className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-2.5 pr-1 text-[11px] font-bold text-white shadow-sm ${appearance.className}`}>
      <span>{label}</span>
      <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${appearance.iconClassName}`}>
        <Icon className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden="true" />
      </span>
    </span>
  )
}

interface ActionAppearance {
  className: string
  icon: LucideIcon
}

function actionAppearance(status: string): ActionAppearance {
  if (status === 'cancelled') {
    return { className: 'border-red-200 text-red-600 hover:border-red-300', icon: X }
  }
  if (status === 'delivered') {
    return { className: 'border-emerald-200 text-emerald-700 hover:border-emerald-300', icon: Check }
  }
  if (status === 'ready_for_pickup') {
    return { className: 'border-violet-200 text-violet-700 hover:border-violet-300', icon: MapPin }
  }
  if (status === 'shipped') {
    return { className: 'border-brand-200 text-brand-500 hover:border-brand-300', icon: Truck }
  }
  return { className: 'border-blue-200 text-blue-700 hover:border-blue-300', icon: Package }
}

function nextFulfillment(order: Order): Array<{ value: string; label: string }> {
  if (
    order.payment_status === 'refunded'
    && ['pending', 'preparing', 'ready_for_pickup'].includes(order.fulfillment_status)
  ) {
    return [{ value: 'cancelled', label: 'Cancelar pedido' }]
  }

  if (order.fulfillment_status === 'pending') {
    return [{ value: 'preparing', label: 'Comenzar preparación' }]
  }
  if (order.fulfillment_status === 'preparing') {
    return order.delivery_method === 'pickup'
      ? [{ value: 'ready_for_pickup', label: 'Listo para retiro' }]
      : [{ value: 'shipped', label: 'Marcar enviado' }]
  }
  if (['ready_for_pickup', 'shipped'].includes(order.fulfillment_status)) {
    return [{ value: 'delivered', label: 'Marcar entregado' }]
  }
  return []
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [refundsEnabled, setRefundsEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [expandedOrderId, setExpandedOrderId] = useState('')
  const [refundOrder, setRefundOrder] = useState<Order | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refundConfirmation, setRefundConfirmation] = useState('')
  const [refundIdempotencyKey, setRefundIdempotencyKey] = useState('')
  const [shippingOrder, setShippingOrder] = useState<Order | null>(null)
  const [shippingCarrier, setShippingCarrier] = useState('Starken')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('https://www.starken.cl/seguimiento')
  const loadingRef = useRef(false)
  const requestRef = useRef<AbortController | null>(null)

  const load = useCallback(async (offset = 0, append = false) => {
    if (append && loadingRef.current) return
    if (!append) requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    loadingRef.current = true
    setError('')
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const response = await fetch(`/api/admin/orders?offset=${offset}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No pudimos cargar los pedidos')
      const incoming = (data.orders || []) as Order[]
      setOrders(current => append
        ? [...current, ...incoming.filter(order => !current.some(existing => existing.public_id === order.public_id))]
        : incoming)
      setRefundsEnabled(Boolean(data.refundsEnabled))
      setHasMore(Boolean(data.hasMore))
      setNextOffset(Number(data.nextOffset || 0))
      setTotalCount(Number(data.totalCount || 0))
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setError(loadError instanceof Error ? loadError.message : 'No pudimos cargar los pedidos')
    } finally {
      if (requestRef.current === controller) {
        setLoading(false)
        setLoadingMore(false)
        loadingRef.current = false
      }
    }
  }, [])

  useEffect(() => { void load(0) }, [load])

  useEffect(() => () => requestRef.current?.abort(), [])

  const loadMore = useCallback(() => {
    void load(nextOffset, true)
  }, [load, nextOffset])

  async function updateFulfillment(
    order: Order,
    status: string,
    tracking?: { carrier: string; trackingNumber: string; trackingUrl: string },
  ) {
    setBusy(order.public_id)
    setError('')
    try {
      const response = await fetch(`/api/admin/orders/${order.public_id}/fulfillment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...tracking }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No pudimos actualizar el pedido')
      if (status === 'shipped') {
        setShippingOrder(null)
        setTrackingNumber('')
        setTrackingUrl('')
      }
      await load(0)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No pudimos actualizar el pedido')
    } finally {
      setBusy('')
    }
  }

  async function submitRefund() {
    if (!refundOrder) return
    setBusy(`refund:${refundOrder.public_id}`)
    setError('')
    try {
      const response = await fetch('/api/admin/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderPublicId: refundOrder.public_id,
          amountClp: Number(refundAmount),
          reason: refundReason,
          confirmation: refundConfirmation,
          idempotencyKey: refundIdempotencyKey,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No pudimos procesar el reembolso')
      setRefundOrder(null)
      setRefundAmount('')
      setRefundReason('')
      setRefundConfirmation('')
      setRefundIdempotencyKey('')
      await load(0)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No pudimos procesar el reembolso')
    } finally {
      setBusy('')
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-4 md:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-body text-2xl font-black text-gray-900">Pedidos Webpay</h1>
          <p className="mt-1 text-sm text-gray-500">
            Pago, preparación, despacho y reembolsos auditados{totalCount > 0 ? ` · ${totalCount} pedidos` : ''}.
          </p>
        </div>
        <button type="button" onClick={() => void load(0)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
          Actualizar
        </button>
      </div>

      {error && <div role="alert" className="mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="mt-8 text-sm text-gray-500">Cargando pedidos…</div>
      ) : orders.length === 0 ? (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Aún no hay pedidos de Webpay.</div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-hidden">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <colgroup>
                <col style={{ width: '20%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '5%' }} />
              </colgroup>
              <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Pedido</th>
                  <th scope="col" className="px-4 py-3">Cliente</th>
                  <th scope="col" className="px-4 py-3">Pago</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3 text-right">Total</th>
                  <th scope="col" className="px-4 py-3">Fecha</th>
                  <th scope="col" className="px-4 py-3 text-right">Acción</th>
                  <th scope="col" className="w-12 px-3 py-3"><span className="sr-only">Ver detalle</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map(order => {
                  const expanded = expandedOrderId === order.public_id
                  const action = nextFulfillment(order)[0]
                  const actionStyle = action ? actionAppearance(action.value) : null
                  const ActionIcon = actionStyle?.icon
                  const detailId = `order-detail-${order.public_id}`

                  return (
                    <Fragment key={order.public_id}>
                    <tr
                      onClick={() => setExpandedOrderId(expanded ? '' : order.public_id)}
                      className="cursor-pointer transition-colors hover:bg-gray-50/70"
                    >
                      <td className="px-5 py-4 align-middle">
                        <p className="whitespace-nowrap font-body text-sm font-black text-gray-900">{order.order_number}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          {order.order_items.length} {order.order_items.length === 1 ? 'producto' : 'productos'}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <p className="font-semibold text-gray-900">{order.buyer_name}</p>
                        <p className="mt-1 max-w-52 truncate text-xs text-gray-500">{order.buyer_email}</p>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <PaymentStatus
                          label={STATUS_LABELS[order.payment_status] || order.payment_status}
                          appearance={PAYMENT_STATUS_APPEARANCE[order.payment_status] || FALLBACK_PAYMENT_STATUS_APPEARANCE}
                        />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <StatusPill
                          label={FULFILLMENT_STATUS_LABELS[order.fulfillment_status] || order.fulfillment_status}
                          appearance={FULFILLMENT_STATUS_APPEARANCE[order.fulfillment_status] || FALLBACK_STATUS_APPEARANCE}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right align-middle font-body font-black text-gray-900">
                        {money.format(order.total_clp)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 align-middle text-xs text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('es-CL')}
                      </td>
                      <td className="px-4 py-4 text-right align-middle">
                        {action ? (
                          <button
                            type="button"
                            disabled={busy === order.public_id}
                            onClick={event => {
                              event.stopPropagation()
                              if (action.value === 'shipped') {
                                setShippingOrder(order)
                                setShippingCarrier('Starken')
                                setTrackingNumber('')
                                setTrackingUrl('https://www.starken.cl/seguimiento')
                              } else {
                                void updateFulfillment(order, action.value)
                              }
                            }}
                            className={`inline-flex h-8 max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md border bg-white px-3 text-[11px] font-bold shadow-[0_2px_5px_rgba(15,23,42,0.09)] transition-all hover:-translate-y-px hover:shadow-[0_3px_7px_rgba(15,23,42,0.11)] active:translate-y-px active:shadow-none disabled:translate-y-0 disabled:opacity-50 ${actionStyle?.className || ''}`}
                          >
                            {ActionIcon && <ActionIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} aria-hidden="true" />}
                            {busy === order.public_id ? 'Actualizando…' : action.label}
                          </button>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-right align-middle">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={detailId}
                          aria-label={`${expanded ? 'Ocultar' : 'Ver'} detalle de ${order.order_number}`}
                          onClick={event => {
                            event.stopPropagation()
                            setExpandedOrderId(expanded ? '' : order.public_id)
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                        </button>
                      </td>

                    </tr>

                      {expanded && (
                        <tr>
                        <td id={detailId} colSpan={8} className="border-t border-gray-200 bg-slate-50 px-5 py-5">
                          <section aria-label={`Cliente de ${order.order_number}`} className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="grid gap-4 sm:grid-cols-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                                  <UserRound className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Cliente</p>
                                  <p className="truncate font-semibold text-gray-900">{order.buyer_name}</p>
                                </div>
                              </div>
                              <a href={`mailto:${order.buyer_email}`} className="flex min-w-0 items-center gap-3 rounded-lg transition-colors hover:text-blue-700">
                                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                  <Mail className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Correo</p>
                                  <p className="truncate text-sm text-gray-700">{order.buyer_email}</p>
                                </div>
                              </a>
                              <a href={`tel:${order.buyer_phone}`} className="flex min-w-0 items-center gap-3 rounded-lg transition-colors hover:text-blue-700">
                                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                  <Phone className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Teléfono</p>
                                  <p className="truncate text-sm text-gray-700">{order.buyer_phone}</p>
                                </div>
                              </a>
                            </div>
                          </section>

                          <div className="grid gap-4 lg:grid-cols-12">
                            <section aria-label={`Productos de ${order.order_number}`} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-5">
                              <div className="flex items-center gap-2">
                                <ShoppingBag className="h-4 w-4 text-blue-600" aria-hidden="true" />
                                <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Productos</h3>
                              </div>
                              <div className="mt-3 divide-y divide-gray-100">
                                {order.order_items.map(item => (
                                  <div key={item.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                                    <div className="min-w-0">
                                      <p className="font-semibold leading-5 text-gray-900">{item.product_name}</p>
                                      <p className="mt-1 text-xs text-gray-500">
                                        {item.quantity} × {money.format(item.unit_price_clp)}
                                        {item.sku ? ` · SKU ${item.sku}` : ''}
                                      </p>
                                    </div>
                                    <span className="shrink-0 font-body font-black text-gray-900">{money.format(item.line_total_clp)}</span>
                                  </div>
                                ))}
                              </div>
                            </section>

                            <section aria-label={`Entrega de ${order.order_number}`} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-4">
                              <div className="flex items-center gap-2">
                                {order.delivery_method === 'pickup'
                                  ? <MapPin className="h-4 w-4 text-violet-600" aria-hidden="true" />
                                  : <Truck className="h-4 w-4 text-indigo-600" aria-hidden="true" />}
                                <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Entrega</h3>
                              </div>
                              <div className="mt-3 text-sm leading-6">
                                <p className="font-bold text-gray-900">{order.delivery_method === 'pickup' ? 'Punto de retiro' : 'Domicilio'}</p>
                                {order.shipping_snapshot.street && <p className="mt-1 text-gray-600">{order.shipping_snapshot.street} {order.shipping_snapshot.number}</p>}
                                {order.shipping_snapshot.pickup_point_id && <p className="mt-1 text-gray-600">{pickupPointLabel(order.shipping_snapshot.pickup_point_id)}</p>}
                                {order.shipping_snapshot.extra && <p className="text-gray-600">{order.shipping_snapshot.extra}</p>}
                                <p className="text-gray-600">{[order.shipping_snapshot.commune, order.shipping_snapshot.region].filter(Boolean).join(', ')}</p>
                                {order.tracking_number && (
                                  <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-600">
                                    <p><span className="font-bold text-gray-800">{order.shipping_carrier}</span> · {order.tracking_number}</p>
                                    {order.tracking_url && (
                                      <a href={order.tracking_url} target="_blank" rel="noreferrer" className="mt-1 inline-block font-semibold text-brand-600 hover:underline">
                                        Abrir seguimiento
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            </section>

                            <section aria-label={`Totales de ${order.order_number}`} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-3">
                              <div className="flex items-center gap-2">
                                <ReceiptText className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                                <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Totales</h3>
                              </div>
                              <dl className="mt-3 space-y-2.5 text-sm">
                                <div className="flex justify-between gap-3 text-gray-600"><dt>Subtotal</dt><dd>{money.format(order.subtotal_clp)}</dd></div>
                                {order.discount_clp > 0 && <div className="flex justify-between gap-3 text-emerald-700"><dt>Descuento</dt><dd>-{money.format(order.discount_clp)}</dd></div>}
                                <div className="flex justify-between gap-3 text-gray-600"><dt>Despacho</dt><dd>{money.format(order.shipping_clp)}</dd></div>
                                <div className="flex justify-between gap-3 border-t border-gray-200 pt-3 font-body text-base font-black text-gray-950"><dt>Total</dt><dd>{money.format(order.total_clp)}</dd></div>
                              </dl>
                            </section>
                          </div>

                          {(order.refunds.length > 0 || (refundsEnabled && order.refundable_clp > 0 && !order.has_open_refund)) && (
                            <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-gray-200 pt-4">
                              <div>
                                {order.refunds.length > 0 && (
                                  <>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Reembolsos</p>
                                    {order.refunds.map(refund => (
                                      <p key={refund.id} className="mt-1 text-xs text-gray-600">
                                        {money.format(refund.amount_clp)} · {STATUS_LABELS[refund.state] || refund.state} · {refund.reason}
                                      </p>
                                    ))}
                                  </>
                                )}
                              </div>
                              {refundsEnabled && order.refundable_clp > 0 && !order.has_open_refund && (
                                <button type="button" onClick={() => { setRefundOrder(order); setRefundAmount(String(order.refundable_clp)); setRefundIdempotencyKey(crypto.randomUUID()) }} className="rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                                  Reembolsar
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <AdminInfiniteScroll
          hasMore={hasMore}
          loading={loadingMore}
          error={error}
          onLoadMore={loadMore}
          label="Cargando más pedidos"
        />
      )}

      {shippingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="shipping-title">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 id="shipping-title" className="font-body text-xl font-black">Despachar {shippingOrder.order_number}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">Al confirmar, el comprador recibirá automáticamente el transportista y su número de seguimiento.</p>
            <label className="mt-5 block text-sm font-semibold">Transportista
              <input required minLength={2} maxLength={80} value={shippingCarrier} onChange={event => setShippingCarrier(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="mt-4 block text-sm font-semibold">Número de seguimiento
              <input required minLength={2} maxLength={120} value={trackingNumber} onChange={event => setTrackingNumber(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="mt-4 block text-sm font-semibold">Link de seguimiento <span className="font-normal text-gray-400">(opcional)</span>
              <input type="url" maxLength={500} placeholder="https://…" value={trackingUrl} onChange={event => setTrackingUrl(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShippingOrder(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold">Cancelar</button>
              <button
                type="button"
                disabled={busy === shippingOrder.public_id || shippingCarrier.trim().length < 2 || trackingNumber.trim().length < 2}
                onClick={() => void updateFulfillment(shippingOrder, 'shipped', {
                  carrier: shippingCarrier.trim(),
                  trackingNumber: trackingNumber.trim(),
                  trackingUrl: trackingUrl.trim(),
                })}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
              >
                {busy === shippingOrder.public_id ? 'Despachando…' : 'Confirmar despacho'}
              </button>
            </div>
          </div>
        </div>
      )}

      {refundOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="refund-title">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 id="refund-title" className="font-body text-xl font-black">Reembolsar {refundOrder.order_number}</h2>
            <p className="mt-2 text-sm text-gray-600">Saldo máximo: {money.format(refundOrder.refundable_clp)}. El stock no se repone automáticamente.</p>
            <label className="mt-5 block text-sm font-semibold">Monto CLP
              <input type="number" min="1" max={refundOrder.refundable_clp} value={refundAmount} onChange={event => setRefundAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="mt-4 block text-sm font-semibold">Motivo
              <textarea minLength={5} maxLength={500} value={refundReason} onChange={event => setRefundReason(event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="mt-4 block text-sm font-semibold">Escribe REEMBOLSAR para confirmar
              <input value={refundConfirmation} onChange={event => setRefundConfirmation(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { setRefundOrder(null); setRefundIdempotencyKey('') }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold">Cancelar</button>
              <button type="button" disabled={busy.startsWith('refund:') || !refundIdempotencyKey || refundConfirmation !== 'REEMBOLSAR' || refundReason.trim().length < 5} onClick={() => void submitRefund()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40">
                {busy.startsWith('refund:') ? 'Procesando…' : 'Confirmar reembolso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
