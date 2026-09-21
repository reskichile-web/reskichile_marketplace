'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { SOLD_CHANNELS } from '@/lib/constants'

interface Props {
  productId: string
  productTitle: string
  listedPrice: number
  canMarkSold: boolean
  iconClassName?: string
}

type Step = 'closed' | 'confirm' | 'outcome' | 'sold'

export default function DeleteProductButton({
  productId,
  productTitle,
  listedPrice,
  canMarkSold,
  iconClassName,
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('closed')
  const [deleting, setDeleting] = useState(false)
  const [savingSale, setSavingSale] = useState(false)
  const [salePrice, setSalePrice] = useState(String(listedPrice))
  const [soldChannel, setSoldChannel] = useState('')
  const [error, setError] = useState('')
  const busy = deleting || savingSale

  function close() {
    if (busy) return
    setStep('closed')
    setError('')
  }

  async function onDelete() {
    setError('')
    setDeleting(true)
    try {
      const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar')
      setStep('closed')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setDeleting(false)
    }
  }

  async function onMarkSold() {
    setError('')
    setSavingSale(true)
    try {
      const digits = salePrice.replace(/\D/g, '')
      const res = await fetch(`/api/products/${productId}/sold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sale_price: digits ? Number.parseInt(digits, 10) : null,
          sold_channel: soldChannel || null,
          sold_speed: null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar la venta')
      setSavingSale(false)
      setStep('closed')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setSavingSale(false)
    }
  }

  const modal = (content: ReactNode, titleId: string) => (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={close}
    >
      <div
        className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl"
        onClick={event => event.stopPropagation()}
      >
        {content}
      </div>
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError('')
          setStep('confirm')
        }}
        aria-label="Eliminar publicación"
        className={iconClassName ?? 'text-gray-400 transition-colors hover:text-red-500'}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </button>

      {step === 'confirm' && modal(
        <>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 id="delete-product-title" className="font-body text-lg font-black text-gray-900">Eliminar publicación</h3>
          </div>
          <p className="text-sm leading-6 text-gray-700">
            ¿Seguro que quieres eliminar <span className="font-semibold">{productTitle}</span>?
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={close}
              className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                setError('')
                if (canMarkSold) setStep('outcome')
                else void onDelete()
              }}
              disabled={busy}
              className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </>,
        'delete-product-title',
      )}

      {step === 'outcome' && modal(
        <>
          <div className="mb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-500">Antes de eliminar</p>
            <h3 id="delete-outcome-title" className="mt-1 font-body text-xl font-black text-gray-900">¿Qué pasó con el producto?</h3>
            <p className="mt-1 text-sm text-gray-500">{productTitle}</p>
          </div>
          <p className="mb-5 text-sm leading-6 text-gray-600">
            Tu respuesta nos ayuda a mantener referencias de venta reales para la comunidad.
          </p>
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => {
                setError('')
                setStep('sold')
              }}
              className="flex w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm font-bold text-emerald-700 hover:bg-emerald-100"
            >
              <span>Sí, lo vendí</span>
              <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={busy}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              {deleting ? 'Eliminando…' : 'No se vendió, eliminar publicación'}
            </button>
          </div>
          {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button type="button" onClick={() => setStep('confirm')} disabled={busy} className="mt-5 w-full py-2 text-sm text-gray-400 hover:text-gray-700 disabled:opacity-50">
            Volver
          </button>
        </>,
        'delete-outcome-title',
      )}

      {step === 'sold' && modal(
        <>
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600">Registrar venta</p>
            <h3 id="delete-sold-title" className="mt-1 font-body text-xl font-black text-gray-900">Cuéntanos lo esencial</h3>
            <p className="mt-1 text-sm text-gray-500">{productTitle}</p>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-gray-800">Precio final <span className="font-normal text-gray-400">(opcional)</span></span>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-gray-400">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={salePrice ? Number(salePrice.replace(/\D/g, '')).toLocaleString('es-CL') : ''}
                  onChange={event => setSalePrice(event.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-7 pr-3"
                  placeholder={listedPrice.toLocaleString('es-CL')}
                />
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-gray-800">Dónde se vendió <span className="font-normal text-gray-400">(opcional)</span></span>
              <select
                value={soldChannel}
                onChange={event => setSoldChannel(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700"
              >
                <option value="">Prefiero no indicar</option>
                {SOLD_CHANNELS.map(channel => (
                  <option key={channel.value} value={channel.value}>{channel.label}</option>
                ))}
              </select>
            </label>
          </div>

          <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-800">
            La publicación saldrá del catálogo, pero conservaremos el registro de la venta.
          </p>
          {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setStep('outcome')}
              disabled={busy}
              className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={() => void onMarkSold()}
              disabled={busy}
              className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {savingSale ? 'Guardando…' : 'Guardar como vendido'}
            </button>
          </div>
        </>,
        'delete-sold-title',
      )}
    </>
  )
}
