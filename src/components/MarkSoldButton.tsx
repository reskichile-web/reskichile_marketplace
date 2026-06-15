'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SOLD_CHANNELS, SOLD_SPEEDS } from '@/lib/constants'

interface Props {
  productId: string
  productTitle: string
  listedPrice: number
  /** 'list' = compact button for mis-productos; 'detail' = full-width for product page */
  variant?: 'list' | 'detail'
}

export default function MarkSoldButton({ productId, productTitle, listedPrice, variant = 'list' }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [channel, setChannel] = useState<string | null>(null)
  const [speed, setSpeed] = useState<string | null>(null)
  const [price, setPrice] = useState<string>(String(listedPrice))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setSaving(true)
    setError('')
    try {
      const digits = price.replace(/\D/g, '')
      const salePrice = digits ? parseInt(digits, 10) : null
      const res = await fetch(`/api/products/${productId}/sold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sale_price: salePrice, sold_channel: channel, sold_speed: speed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo marcar como vendido')
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setSaving(false)
    }
  }

  const tagIcon = (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </svg>
  )

  const chip = (selected: boolean) =>
    `px-3 py-2 rounded-lg border-2 text-sm text-left transition-all ${
      selected
        ? 'border-brand-500 bg-brand-50 text-brand-600 font-medium'
        : 'border-gray-100 text-gray-600 hover:border-gray-300'
    }`

  return (
    <>
      {variant === 'detail' ? (
        <button
          onClick={() => setOpen(true)}
          className="pressable w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 hover:bg-green-700 font-medium text-xs sm:text-sm whitespace-nowrap"
        >
          {tagIcon}
          ¡Lo vendí!
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-center text-xs py-1.5 px-3 rounded font-medium bg-green-600 text-white hover:bg-green-700"
        >
          {tagIcon}
          ¡Lo vendí!
        </button>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !saving && setOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-body text-lg font-black text-gray-900">¿Vendiste tu producto?</h3>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{productTitle}</p>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Channel — optional */}
              <div>
                <p className="text-sm font-medium mb-2">¿Por dónde lo vendiste? <span className="text-gray-400 font-normal">(opcional)</span></p>
                <div className="grid grid-cols-1 gap-2">
                  {SOLD_CHANNELS.map(c => (
                    <button key={c.value} type="button" onClick={() => setChannel(channel === c.value ? null : c.value)} className={chip(channel === c.value)}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Speed — optional */}
              <div>
                <p className="text-sm font-medium mb-2">¿Cómo fue la venta? <span className="text-gray-400 font-normal">(opcional)</span></p>
                <div className="grid grid-cols-1 gap-2">
                  {SOLD_SPEEDS.map(s => (
                    <button key={s.value} type="button" onClick={() => setSpeed(speed === s.value ? null : s.value)} className={chip(speed === s.value)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sale price — optional, prefilled */}
              <div>
                <label className="text-sm font-medium block mb-1">¿En cuánto lo vendiste? <span className="text-gray-400 font-normal">(opcional)</span></label>
                <p className="text-xs text-gray-400 mb-1.5">Nos ayuda a dar mejores referencias de precio de mercado.</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={price ? Number(price.replace(/\D/g, '')).toLocaleString('es-CL') : ''}
                    onChange={e => setPrice(e.target.value.replace(/\D/g, ''))}
                    className="w-full border rounded-lg pl-7 pr-3 py-2.5"
                    placeholder={listedPrice.toLocaleString('es-CL')}
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={saving} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Marcando...
                  </>
                ) : 'Marcar como vendido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
