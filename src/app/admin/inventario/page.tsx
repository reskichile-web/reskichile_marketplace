'use client'

import { useCallback, useEffect, useState } from 'react'
import { Warehouse } from 'lucide-react'
import {
  changedRackInventoryItems,
  type RackInventoryProduct,
  type RackInventoryResponse,
} from '@/lib/rack-inventory'

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

const ORIGINS = [
  { code: 'las_condes', label: 'Las Condes' },
  { code: 'los_angeles', label: 'Los Ángeles' },
] as const

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<RackInventoryProduct[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingSlug, setSavingSlug] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const applyData = useCallback((data: RackInventoryResponse) => {
    setProducts(data.products)
    setDraft(Object.fromEntries(data.products.flatMap(product => (
      product.variants.map(variant => [variant.inventoryId, String(variant.stockOnHand)])
    ))))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/inventory', { cache: 'no-store' })
      const data = await response.json() as RackInventoryResponse & { error?: string }
      if (!response.ok) throw new Error(data.error || 'No pudimos cargar el inventario')
      applyData(data)
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Error al cargar' })
    } finally {
      setLoading(false)
    }
  }, [applyData])

  useEffect(() => {
    load()
  }, [load])

  async function saveProduct(product: RackInventoryProduct) {
    const items = changedRackInventoryItems(product, draft)

    if (items.length === 0) return

    setSavingSlug(product.slug)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await response.json() as RackInventoryResponse & { error?: string }
      if (!response.ok) throw new Error(data.error || 'No pudimos guardar el inventario')
      applyData(data)
      setMessage({ tone: 'ok', text: `Stock de ${product.name} actualizado.` })
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Error al guardar' })
    } finally {
      setSavingSlug(null)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-500">Ski Rack</p>
          <h1 className="mt-1 font-body text-3xl font-black text-gray-900">Inventario</h1>
          <p className="mt-2 text-sm text-gray-500">Stock físico por producto, talla y origen. Las reservas de Webpay se descuentan del disponible.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          Actualizar
        </button>
      </div>

      {message && (
        <div className={`mt-6 rounded-xl border px-4 py-3 text-sm ${message.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="mt-8 space-y-4">
          {[0, 1].map(item => <div key={item} className="h-56 animate-pulse rounded-2xl bg-gray-100" />)}
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {products.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-sm text-gray-500">
              No hay productos Ski Rack configurados en inventario.
            </div>
          )}
          {products.map(product => {
            const available = product.variants.reduce((sum, variant) => sum + variant.availableQuantity, 0)
            const reserved = product.variants.reduce((sum, variant) => sum + variant.reservedQuantity, 0)
            const editableVariants = product.variants.filter(variant => variant.inventoryId)
            const hasInvalidDraft = editableVariants.some(variant => draft[variant.inventoryId] === '')
            const changedCount = editableVariants.filter(variant => (
              draft[variant.inventoryId] !== undefined
              && draft[variant.inventoryId] !== ''
              && Number(draft[variant.inventoryId]) !== variant.stockOnHand
            )).length
            return (
              <section
                key={product.slug}
                className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm xl:grid-cols-[minmax(180px,0.7fr)_minmax(260px,1fr)_minmax(260px,1fr)_auto] xl:items-stretch"
              >
                <div className="flex min-w-0 flex-col justify-between py-1">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{product.material}</p>
                    <h2 className="mt-1 font-body text-xl font-black">{product.name}</h2>
                    <p className="mt-1 text-sm font-semibold text-brand-500">{money.format(product.priceClp)}</p>
                  </div>
                  <span className={`mt-5 w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${available === 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                    {available === 0 ? 'Sin stock' : `${available} disponibles`}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:contents">
                  {ORIGINS.map(origin => (
                    <div key={origin.code} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <div className="mb-4 flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand-500 shadow-sm ring-1 ring-gray-100">
                          <Warehouse className="h-[18px] w-[18px]" strokeWidth={1.8} />
                        </span>
                        <p className="text-xs font-black uppercase tracking-wider text-gray-700">
                          {origin.label}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {product.variants
                          .filter(variant => variant.originCode === origin.code)
                          .map(variant => (
                            <label key={variant.inventoryId || `${origin.code}:${variant.size}`} className="min-w-0">
                              <span className="block text-center text-[10px] font-black uppercase tracking-wider text-gray-500">
                                Talla {variant.size}
                              </span>
                              <input
                                type="number"
                                min="0"
                                max="100000"
                                step="1"
                                value={draft[variant.inventoryId] ?? ''}
                                disabled={!variant.inventoryId}
                                aria-label={`${product.name}, ${origin.label}, talla ${variant.size}`}
                                onChange={event => setDraft(current => ({
                                  ...current,
                                  [variant.inventoryId]: event.target.value.replace(/[^0-9]/g, ''),
                                }))}
                                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-2 py-2.5 text-center text-base font-black text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-gray-100"
                              />
                              <span className="mt-1.5 block truncate text-center text-[9px] text-gray-400">
                                {variant.reservedQuantity > 0
                                  ? `${variant.reservedQuantity} reservadas`
                                  : `${variant.availableQuantity} libres`}
                              </span>
                            </label>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex min-w-[136px] flex-row items-center justify-between gap-3 border-t border-gray-100 pt-4 xl:flex-col xl:items-stretch xl:justify-center xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
                  <p className="text-xs leading-5 text-gray-400 xl:text-center">
                    {reserved > 0 ? `${reserved} en pagos activos` : 'Sin reservas activas'}
                  </p>
                  <button
                    type="button"
                    onClick={() => saveProduct(product)}
                    disabled={savingSlug !== null || hasInvalidDraft || changedCount === 0}
                    className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                  >
                    {savingSlug === product.slug ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}
