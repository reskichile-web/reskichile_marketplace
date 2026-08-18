'use client'

import { useCallback, useEffect, useState } from 'react'

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

function nextFulfillment(order: Order): Array<{ value: string; label: string }> {
  if (order.fulfillment_status === 'pending') {
    return [
      { value: 'preparing', label: 'Comenzar preparación' },
      ...(order.payment_status === 'refunded' ? [{ value: 'cancelled', label: 'Cancelar' }] : []),
    ]
  }
  if (order.fulfillment_status === 'preparing') {
    return order.delivery_method === 'pickup'
      ? [{ value: 'ready_for_pickup', label: 'Listo para retiro' }]
      : [{ value: 'shipped', label: 'Marcar despachado' }]
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
        <div className="mt-6 space-y-5">
          {orders.map(order => (
            <article key={order.public_id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{order.order_number}</p>
                  <h2 className="mt-1 font-body text-lg font-black">{order.buyer_name}</h2>
                  <p className="mt-1 text-sm text-gray-500">{order.buyer_email} · {order.buyer_phone}</p>
                </div>
                <div className="text-right">
                  <p className="font-body text-xl font-black">{money.format(order.total_clp)}</p>
                  <p className="mt-1 text-xs text-gray-500">{new Date(order.created_at).toLocaleString('es-CL')}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{STATUS_LABELS[order.payment_status] || order.payment_status}</span>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">{STATUS_LABELS[order.fulfillment_status] || order.fulfillment_status}</span>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-[1fr_300px]">
                <div>
                  {order.order_items.map(item => (
                    <div key={item.id} className="flex justify-between border-b border-gray-100 py-2 text-sm last:border-0">
                      <span>{item.product_name} × {item.quantity}</span>
                      <span className="font-semibold">{money.format(item.line_total_clp)}</span>
                    </div>
                  ))}
                  {order.refunds.length > 0 && (
                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Reembolsos</p>
                      {order.refunds.map(refund => (
                        <p key={refund.id} className="mt-2 text-xs text-gray-600">
                          {money.format(refund.amount_clp)} · {STATUS_LABELS[refund.state] || refund.state} · {refund.reason}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-lg bg-gray-50 p-4 text-sm">
                  <p className="font-semibold text-gray-900">Entrega</p>
                  <p className="mt-1 text-gray-600">{order.delivery_method === 'pickup' ? 'Punto de retiro' : 'Domicilio'}</p>
                  <p className="text-gray-600">{[order.shipping_snapshot.commune, order.shipping_snapshot.region].filter(Boolean).join(', ')}</p>
                  {order.shipping_snapshot.street && <p className="mt-1 text-gray-600">{order.shipping_snapshot.street} {order.shipping_snapshot.number}</p>}
                  {order.shipping_snapshot.pickup_point_id && <p className="mt-1 text-gray-600">{order.shipping_snapshot.pickup_point_id}</p>}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                {nextFulfillment(order).map(action => (
                  <button key={action.value} type="button" disabled={busy === order.public_id} onClick={() => void updateFulfillment(order, action.value)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
                    {action.label}
                  </button>
                ))}
                {refundsEnabled && order.refundable_clp > 0 && !order.has_open_refund && (
                  <button type="button" onClick={() => { setRefundOrder(order); setRefundAmount(String(order.refundable_clp)); setRefundIdempotencyKey(crypto.randomUUID()) }} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                    Reembolsar
                  </button>
                )}
              </div>
            </article>
          ))}
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
