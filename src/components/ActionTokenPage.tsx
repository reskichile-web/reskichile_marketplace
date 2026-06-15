'use client'

import { useState } from 'react'
import { SOLD_CHANNELS, SOLD_SPEEDS } from '@/lib/constants'

interface Product {
  id: string
  brand: string
  model: string | null
  price: number
  slug: string | null
  image_url: string | null
}

interface Props {
  token: string
  endpoint: string
  product: Product
  /** Header + button copy */
  title: string
  subtitle: string
  buttonLabel: string
  buttonTone: 'green' | 'gray' | 'brand'
  successTitle: string
  successBody: string
  /** Show channel/speed/price inputs (the "Sí, lo vendí" flow) */
  withSaleForm?: boolean
}

function formatCLP(n: number) {
  return '$' + n.toLocaleString('es-CL')
}

export default function ActionTokenPage({
  token, endpoint, product, title, subtitle, buttonLabel, buttonTone,
  successTitle, successBody, withSaleForm,
}: Props) {
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [channel, setChannel] = useState<string | null>(null)
  const [speed, setSpeed] = useState<string | null>(null)
  const [price, setPrice] = useState<string>(withSaleForm ? String(product.price) : '')

  const tones: Record<string, string> = {
    green: 'bg-green-600 hover:bg-green-700',
    gray: 'bg-gray-900 hover:bg-gray-800',
    brand: 'bg-brand-500 hover:bg-brand-600',
  }

  async function submit() {
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = { token }
      if (withSaleForm) {
        const digits = price.replace(/\D/g, '')
        payload.sale_price = digits ? parseInt(digits, 10) : null
        payload.sold_channel = channel
        payload.sold_speed = speed
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo completar la acción')
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setSaving(false)
    }
  }

  const title2 = [product.brand, product.model].filter(Boolean).join(' ') || 'Producto'

  const chip = (selected: boolean) =>
    `px-3 py-2 rounded-lg border-2 text-sm text-left transition-all ${
      selected ? 'border-brand-500 bg-brand-50 text-brand-600 font-medium' : 'border-gray-100 text-gray-600 hover:border-gray-300'
    }`

  if (done) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-body text-2xl font-black text-gray-900 mb-2">{successTitle}</h1>
          <p className="text-sm text-gray-500 mb-6">{successBody}</p>
          <a href={`/producto/${product.slug || product.id}`} className="inline-block bg-brand-500 text-white px-6 py-2.5 rounded-lg hover:bg-brand-600 text-sm font-medium">
            Ver publicación
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white border border-gray-200 rounded-xl p-7 shadow-sm">
        <h1 className="font-body text-2xl font-black text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>

        <div className="flex items-center gap-3 mt-5 mb-5 bg-gray-50 border border-gray-100 rounded-xl p-3">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-gray-200 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900 truncate">{title2}</p>
            <p className="text-sm font-bold text-brand-500">{formatCLP(product.price)}</p>
          </div>
        </div>

        {withSaleForm && (
          <div className="space-y-5 mb-5">
            <div>
              <p className="text-sm font-medium mb-2">¿Por dónde lo vendiste? <span className="text-gray-400 font-normal">(opcional)</span></p>
              <div className="grid grid-cols-1 gap-2">
                {SOLD_CHANNELS.map(c => (
                  <button key={c.value} type="button" onClick={() => setChannel(channel === c.value ? null : c.value)} className={chip(channel === c.value)}>{c.label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">¿Cómo fue la venta? <span className="text-gray-400 font-normal">(opcional)</span></p>
              <div className="grid grid-cols-1 gap-2">
                {SOLD_SPEEDS.map(s => (
                  <button key={s.value} type="button" onClick={() => setSpeed(speed === s.value ? null : s.value)} className={chip(speed === s.value)}>{s.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">¿En cuánto lo vendiste? <span className="text-gray-400 font-normal">(opcional)</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={price ? Number(price.replace(/\D/g, '')).toLocaleString('es-CL') : ''}
                  onChange={e => setPrice(e.target.value.replace(/\D/g, ''))}
                  className="w-full border rounded-lg pl-7 pr-3 py-2.5"
                  placeholder={product.price.toLocaleString('es-CL')}
                />
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}

        <button
          onClick={submit}
          disabled={saving}
          className={`w-full text-white py-3 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${tones[buttonTone]}`}
        >
          {saving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Procesando...
            </>
          ) : buttonLabel}
        </button>
      </div>
    </div>
  )
}
