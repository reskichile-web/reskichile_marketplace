'use client'

import { useState } from 'react'

interface Props {
  order: {
    public_id: string; order_number: string; delivery_method: string; payment_status: string
    payment_method?: string; total_clp: number; subtotal_clp: number; discount_clp: number
    fulfillment_status: string
  }
  onUpdated: () => Promise<void>
}

const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

export default function OrderRecoveryActions({ order, onUpdated }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('Entrega personal coordinada con ReSkiChile. Sin costo de despacho.')
  const [method, setMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const manualPending = order.payment_method === 'manual_pending' && order.payment_status === 'pending'
  const canConvert = order.delivery_method !== 'manual' &&
    !['authorized', 'partially_refunded', 'refunded'].includes(order.payment_status) &&
    !['shipped', 'delivered'].includes(order.fulfillment_status)

  async function submit(action: string) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/orders/${order.public_id}/recovery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note, method, reference, amountClp: order.total_clp }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No pudimos actualizar el pedido.')
      await onUpdated()
      setOpen(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos actualizar el pedido.') }
    finally { setBusy(false) }
  }

  if (!canConvert && !manualPending && order.delivery_method !== 'manual' && order.payment_status !== 'reconciliation_required') return null

  return (
    <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        {order.payment_status === 'reconciliation_required' && (
          <button disabled={busy} onClick={() => void submit('review_payment')} className="rounded-lg border px-3 py-2 font-semibold disabled:opacity-50">Consultar Webpay</button>
        )}
        {(canConvert || manualPending) && (
          <button disabled={busy} onClick={() => setOpen(!open)} className="rounded-lg border px-3 py-2 font-semibold disabled:opacity-50">
            {manualPending ? 'Registrar pago recibido' : 'Coordinar entrega personal'}
          </button>
        )}
        {order.delivery_method === 'manual' && <span>Entrega personal · Sin despacho · {money.format(order.total_clp)}</span>}
      </div>
      {open && canConvert && (
        <form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); void submit('manual_delivery') }}>
          <p>Se quitará el despacho. Total: <strong>{money.format(order.subtotal_clp - order.discount_clp)}</strong>. El pago quedará pendiente y el producto se reservará durante 7 días.</p>
          <label className="block">Coordinación de entrega
            <textarea required minLength={5} maxLength={500} value={note} onChange={e => setNote(e.target.value)} className="mt-1 block w-full rounded border p-2" />
          </label>
          <button disabled={busy} className="rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white disabled:opacity-50">Guardar entrega personal</button>
        </form>
      )}
      {open && manualPending && (
        <form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); void submit('manual_payment') }}>
          <p>Registra únicamente un pago ya recibido por <strong>{money.format(order.total_clp)}</strong>. Se confirmará la compra y se enviará su correo de confirmación.</p>
          <label className="block">Medio de pago
            <select value={method} onChange={e => setMethod(e.target.value)} className="ml-3 rounded border p-2"><option value="bank_transfer">Transferencia</option><option value="cash">Efectivo</option></select>
          </label>
          <label className="block">Referencia o respaldo del pago
            <input required minLength={3} maxLength={200} value={reference} onChange={e => setReference(e.target.value)} className="mt-1 block w-full rounded border p-2" />
          </label>
          <button disabled={busy} className="rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white disabled:opacity-50">Confirmar pago recibido</button>
        </form>
      )}
      {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
    </section>
  )
}
