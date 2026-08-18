'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RackInventoryProduct, RackInventoryResponse } from '@/lib/rack-inventory'

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

const ORIGINS = [
  { code: 'los_angeles', label: 'Los Ángeles' },
  { code: 'las_condes', label: 'Las Condes' },
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
    setSavingSlug(product.slug)
    setMessage(null)
    try {
      const items = product.variants
        .filter(variant => variant.inventoryId)
        .map(variant => ({
          inventoryId: variant.inventoryId,
          stockOnHand: Number(draft[variant.inventoryId]),
        }))
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
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {[0, 1].map(item => <div key={item} className="h-72 animate-pulse rounded-2xl bg-gray-100" />)}
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {products.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-sm text-gray-500 md:col-span-2">
              No hay productos Ski Rack configurados en inventario.
            </div>
          )}
          {products.map(product => {
            const available = product.variants.reduce((sum, variant) => sum + variant.availableQuantity, 0)
            const reserved = product.variants.reduce((sum, variant) => sum + variant.reservedQuantity, 0)
            return (
              <section key={product.slug} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{product.material}</p>
                    <h2 className="mt-1 font-body text-xl font-black">{product.name}</h2>
                    <p className="mt-1 text-sm font-semibold text-brand-500">{money.format(product.priceClp)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${available === 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                    {available === 0 ? 'Sin stock' : `${available} disponibles`}
                  </span>
                </div>

                <div className="mt-6 space-y-5">
                  {ORIGINS.map(origin => (
                    <div key={origin.code}>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        {origin.label}
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {product.variants
                          .filter(variant => variant.originCode === origin.code)
                          .map(variant => (
                            <label key={variant.inventoryId || `${origin.code}:${variant.size}`} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                              <span className="text-xs font-black text-gray-700">Talla {variant.size}</span>
                              <input
                                type="number"
                                min="0"
                                max="100000"
                                step="1"
                                value={draft[variant.inventoryId] ?? ''}
                                disabled={!variant.inventoryId}
                                onChange={event => setDraft(current => ({
                                  ...current,
                                  [variant.inventoryId]: event.target.value.replace(/[^0-9]/g, ''),
                                }))}
                                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-center text-lg font-black outline-none focus:border-brand-500 disabled:bg-gray-100"
                              />
                              <span className="mt-2 block text-[10px] leading-4 text-gray-400">
                                {variant.reservedQuantity} reservadas · {variant.availableQuantity} libres
                              </span>
                            </label>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
                  <p className="text-xs text-gray-400">{reserved} unidades en pagos activos</p>
                  <button
                    type="button"
                    onClick={() => saveProduct(product)}
                    disabled={savingSlug !== null || product.variants.some(variant => (
                      !variant.inventoryId || draft[variant.inventoryId] === ''
                    ))}
                    className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    {savingSlug === product.slug ? 'Guardando…' : 'Guardar stock'}
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
