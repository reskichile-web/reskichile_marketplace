'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'

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
  pending: 'Por preparar',
  preparing: 'Preparando',
  ready_for_pickup: 'Listo para retiro',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
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
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [expandedOrderId, setExpandedOrderId] = useState('')
  const [refundOrder, setRefundOrder] = useState<Order | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refundConfirmation, setRefundConfirmation] = useState('')
  const [refundIdempotencyKey, setRefundIdempotencyKey] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await fetch('/api/admin/orders', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No pudimos cargar los pedidos')
      setOrders(data.orders || [])
      setRefundsEnabled(Boolean(data.refundsEnabled))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No pudimos cargar los pedidos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function updateFulfillment(order: Order, status: string) {
    setBusy(order.public_id)
    setError('')
    try {
      const response = await fetch(`/api/admin/orders/${order.public_id}/fulfillment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No pudimos actualizar el pedido')
      await load()
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
      await load()
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
          <p className="mt-1 text-sm text-gray-500">Pago, preparación, despacho y reembolsos auditados.</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
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
          <div className="overflow-x-auto">
            <table className="min-w-[1080px] w-full border-collapse text-left text-sm">
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
                  const detailId = `order-detail-${order.public_id}`

                  return (
                    <Fragment key={order.public_id}>
                    <tr className="transition-colors hover:bg-gray-50/70">
                      <td className="px-5 py-4 align-middle">
                        <p className="font-body text-sm font-black text-gray-900">{order.order_number}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          {order.order_items.length} {order.order_items.length === 1 ? 'producto' : 'productos'}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <p className="font-semibold text-gray-900">{order.buyer_name}</p>
                        <p className="mt-1 max-w-52 truncate text-xs text-gray-500">{order.buyer_email}</p>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {STATUS_LABELS[order.payment_status] || order.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                          {FULFILLMENT_STATUS_LABELS[order.fulfillment_status] || order.fulfillment_status}
                        </span>
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
                            onClick={() => void updateFulfillment(order, action.value)}
                            className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
                              action.value === 'cancelled'
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-gray-900 hover:bg-gray-800'
                            }`}
                          >
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
                          onClick={() => setExpandedOrderId(expanded ? '' : order.public_id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                        </button>
                      </td>

                    </tr>

                      {expanded && (
                        <tr>
                        <td id={detailId} colSpan={8} className="border-t border-gray-100 bg-gray-50/70 px-5 py-5">
                          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(230px,0.8fr)_minmax(190px,0.55fr)]">
                            <section aria-label={`Productos de ${order.order_number}`}>
                              <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Productos</h3>
                              <div className="mt-2 divide-y divide-gray-200">
                                {order.order_items.map(item => (
                                  <div key={item.id} className="flex justify-between gap-4 py-2 text-sm">
                                    <span className="text-gray-700">{item.product_name} × {item.quantity}</span>
                                    <span className="font-semibold text-gray-900">{money.format(item.line_total_clp)}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-4 text-xs leading-5 text-gray-500">
                                <p className="font-semibold text-gray-800">{order.buyer_name}</p>
                                <p>{order.buyer_email}</p>
                                <p>{order.buyer_phone}</p>
                              </div>
                            </section>

                            <section aria-label={`Entrega de ${order.order_number}`}>
                              <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Entrega</h3>
                              <div className="mt-2 rounded-lg border border-gray-200 bg-white p-4 text-sm leading-6">
                                <p className="font-semibold text-gray-900">{order.delivery_method === 'pickup' ? 'Punto de retiro' : 'Domicilio'}</p>
                                {order.shipping_snapshot.street && <p className="text-gray-600">{order.shipping_snapshot.street} {order.shipping_snapshot.number}</p>}
                                {order.shipping_snapshot.pickup_point_id && <p className="text-gray-600">{order.shipping_snapshot.pickup_point_id}</p>}
                                {order.shipping_snapshot.extra && <p className="text-gray-600">{order.shipping_snapshot.extra}</p>}
                                <p className="text-gray-600">{[order.shipping_snapshot.commune, order.shipping_snapshot.region].filter(Boolean).join(', ')}</p>
                              </div>
                            </section>

                            <section aria-label={`Totales de ${order.order_number}`}>
                              <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Totales</h3>
                              <dl className="mt-2 space-y-2 text-sm">
                                <div className="flex justify-between gap-3 text-gray-600"><dt>Subtotal</dt><dd>{money.format(order.subtotal_clp)}</dd></div>
                                {order.discount_clp > 0 && <div className="flex justify-between gap-3 text-emerald-700"><dt>Descuento</dt><dd>-{money.format(order.discount_clp)}</dd></div>}
                                <div className="flex justify-between gap-3 text-gray-600"><dt>Despacho</dt><dd>{money.format(order.shipping_clp)}</dd></div>
                                <div className="flex justify-between gap-3 border-t border-gray-200 pt-2 font-black text-gray-900"><dt>Total</dt><dd>{money.format(order.total_clp)}</dd></div>
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
