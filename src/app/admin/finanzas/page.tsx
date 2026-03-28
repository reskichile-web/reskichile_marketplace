'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_TYPES } from '@/lib/constants'
import AdminTableSkeleton from '@/components/skeletons/AdminTableSkeleton'

interface SaleRecord {
  id: string
  product_type: string
  brand: string
  model: string | null
  condition: string
  region: string
  listing_price: number
  sale_price: number | null
  price_difference: number | null
  listed_at: string
  recorded_at: string
  seller_name: string | null
  seller_email: string | null
}

function formatCLP(n: number) {
  return '$' + n.toLocaleString('es-CL')
}

export default function FinanzasPage() {
  const [records, setRecords] = useState<SaleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('sales_history')
        .select('id, product_type, brand, model, condition, region, listing_price, sale_price, price_difference, listed_at, recorded_at, seller_name, seller_email')
        .eq('status', 'sold')
        .order('recorded_at', { ascending: false })

      setRecords((data as SaleRecord[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  // ─── By category (uses ALL records from sales_history, not just sold) ───
  const [allRecords, setAllRecords] = useState<{ product_type: string; status: string; listing_price: number }[]>([])

  useEffect(() => {
    async function loadAll() {
      const supabase = createClient()
      const { data } = await supabase
        .from('sales_history')
        .select('product_type, status, listing_price')

      setAllRecords(data || [])
    }
    loadAll()
  }, [])

  const byCategory = useMemo(() => {
    const map: Record<string, { total: number; sold: number; totalValue: number }> = {}
    allRecords.forEach(r => {
      if (!map[r.product_type]) map[r.product_type] = { total: 0, sold: 0, totalValue: 0 }
      map[r.product_type].total++
      map[r.product_type].totalValue += r.listing_price
      if (r.status === 'sold') map[r.product_type].sold++
    })
    return Object.entries(map)
      .map(([type, data]) => ({
        type,
        ...data,
        notSold: data.total - data.sold,
        avgPrice: Math.round(data.totalValue / data.total),
        soldPct: data.total > 0 ? (data.sold / data.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
  }, [allRecords])

  // ─── Filtered sold table ───
  const filtered = useMemo(() => {
    return records.filter(r => {
      if (typeFilter && r.product_type !== typeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const text = [r.brand, r.model, r.seller_name, r.seller_email].filter(Boolean).join(' ').toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [records, typeFilter, search])

  if (loading) return <AdminTableSkeleton />

  return (
    <div className="max-w-7xl mx-auto mt-0 px-4 md:px-8 pt-4 pb-16">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-body text-2xl font-black text-gray-900">Finanzas</h1>
        <p className="text-sm text-gray-500 mt-1">Historial de ventas · {records.length} vendidos</p>
      </div>

      {/* ─── Category Chart ─── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-bold text-gray-900 mb-5">Proporcion por categoria</h2>
        <div className="space-y-4">
          {byCategory.map(cat => (
            <div key={cat.type}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-gray-700">{PRODUCT_TYPES[cat.type] || cat.type}</span>
                <div className="text-right">
                  <span className="text-xs text-gray-400 mr-1.5">Prom. venta</span>
                  <span className="text-sm font-black text-gray-900">{formatCLP(cat.avgPrice)}</span>
                </div>
              </div>
              {/* Bar — full width with diagonal / separator */}
              <div className="relative h-9 rounded-lg overflow-hidden">
                <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                  {/* Sold portion */}
                  <polygon
                    points={`0,0 ${cat.soldPct},0 ${Math.max(cat.soldPct - 3, 0)},100 0,100`}
                    className="fill-brand-500"
                  />
                  {/* Not sold portion */}
                  <polygon
                    points={`${cat.soldPct},0 100,0 100,100 ${Math.max(cat.soldPct - 3, 0)},100`}
                    className="fill-brand-100"
                  />
                </svg>
                {/* Labels inside bars */}
                <div className="absolute inset-0 flex">
                  <div className="flex items-center justify-center text-white text-xs font-bold" style={{ width: `${Math.max(cat.soldPct, cat.sold > 0 ? 20 : 0)}%` }}>
                    {cat.sold > 0 && cat.sold}
                  </div>
                  <div className="flex-1 flex items-center justify-center text-brand-600 text-xs font-bold">
                    {cat.notSold > 0 && cat.notSold}
                  </div>
                </div>
              </div>
              {/* Labels below */}
              <div className="flex mt-1">
                <div style={{ width: `${Math.max(cat.soldPct, cat.sold > 0 ? 20 : 0)}%` }} className="text-center">
                  <span className="text-[10px] text-gray-400">Vendidos</span>
                </div>
                <div className="flex-1 text-center">
                  <span className="text-[10px] text-gray-400">No vendidos</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Sold Table ─── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Productos vendidos</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar marca, modelo, vendedor..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm w-40"
            >
              <option value="">Todos los tipos</option>
              {Object.entries(PRODUCT_TYPES).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Vendedor</th>
                <th className="px-4 py-3 font-medium">Precio pub.</th>
                <th className="px-4 py-3 font-medium">Precio venta</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Diferencia</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Region</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No hay ventas registradas
                  </td>
                </tr>
              ) : filtered.map(r => {
                const title = [r.brand, r.model].filter(Boolean).join(' ')
                const diff = r.price_difference
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-900">{title}</span>
                        <span className="block text-xs text-gray-400">{PRODUCT_TYPES[r.product_type] || r.product_type}</span>
                        <span className="block sm:hidden text-xs text-gray-500 mt-0.5">{r.seller_name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div>
                        <span className="text-gray-700">{r.seller_name || '—'}</span>
                        {r.seller_email && <span className="block text-xs text-gray-400">{r.seller_email}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatCLP(r.listing_price)}
                    </td>
                    <td className="px-4 py-3 font-bold text-green-600">
                      {r.sale_price ? formatCLP(r.sale_price) : '—'}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {diff !== null && diff !== 0 ? (
                        <span className={`text-xs font-medium ${diff > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {diff > 0 ? '-' : '+'}{formatCLP(Math.abs(diff))}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">{r.region}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-500">
                      {new Date(r.listed_at).toLocaleDateString('es-CL')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t bg-gray-50/50 flex items-center justify-between text-xs text-gray-500">
            <span>{filtered.length} ventas</span>
            <div className="flex gap-4">
              <span>Total publicado: <span className="font-bold text-gray-700">{formatCLP(filtered.reduce((s, r) => s + r.listing_price, 0))}</span></span>
              <span>Total vendido: <span className="font-bold text-green-600">{formatCLP(filtered.reduce((s, r) => s + (r.sale_price || 0), 0))}</span></span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
