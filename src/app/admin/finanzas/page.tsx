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
  status: string
  listed_at: string
  seller_name: string | null
  seller_email: string | null
}

const STATUS_COLORS: Record<string, string> = {
  sold: 'bg-green-100 text-green-700',
  approved: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
  archived: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  sold: 'Vendido',
  approved: 'Aprobado',
  pending: 'Pendiente',
  rejected: 'Rechazado',
  archived: 'Archivado',
  draft: 'Borrador',
  missing_photos: 'Faltan fotos',
}

function formatCLP(n: number) {
  return '$' + n.toLocaleString('es-CL')
}

export default function FinanzasPage() {
  const [records, setRecords] = useState<SaleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('sales_history')
        .select('id, product_type, brand, model, condition, region, listing_price, sale_price, price_difference, status, listed_at, seller_name, seller_email')
        .order('listed_at', { ascending: false })

      setRecords((data as SaleRecord[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  // ─── Stats ───
  const stats = useMemo(() => {
    const total = records.length
    const sold = records.filter(r => r.status === 'sold')
    const withSalePrice = records.filter(r => r.sale_price !== null)
    const totalListing = records.reduce((s, r) => s + r.listing_price, 0)
    const totalSale = withSalePrice.reduce((s, r) => s + (r.sale_price || 0), 0)
    const avgListing = total > 0 ? Math.round(totalListing / total) : 0
    const avgSale = withSalePrice.length > 0 ? Math.round(totalSale / withSalePrice.length) : 0
    const conversionRate = total > 0 ? Math.round((sold.length / total) * 100) : 0

    return { total, sold: sold.length, withSalePrice: withSalePrice.length, totalListing, totalSale, avgListing, avgSale, conversionRate }
  }, [records])

  // ─── By category ───
  const byCategory = useMemo(() => {
    const map: Record<string, { total: number; sold: number; totalValue: number; totalSaleValue: number }> = {}
    records.forEach(r => {
      if (!map[r.product_type]) map[r.product_type] = { total: 0, sold: 0, totalValue: 0, totalSaleValue: 0 }
      map[r.product_type].total++
      map[r.product_type].totalValue += r.listing_price
      if (r.status === 'sold') map[r.product_type].sold++
      if (r.sale_price) map[r.product_type].totalSaleValue += r.sale_price
    })
    return Object.entries(map)
      .map(([type, data]) => ({ type, ...data, avgPrice: Math.round(data.totalValue / data.total) }))
      .sort((a, b) => b.total - a.total)
  }, [records])

  // ─── By region ───
  const byRegion = useMemo(() => {
    const map: Record<string, number> = {}
    records.forEach(r => { map[r.region] = (map[r.region] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [records])

  // ─── Filtered table ───
  const filtered = useMemo(() => {
    return records.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (typeFilter && r.product_type !== typeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const text = [r.brand, r.model, r.seller_name, r.seller_email].filter(Boolean).join(' ').toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [records, statusFilter, typeFilter, search])

  if (loading) return <AdminTableSkeleton />

  const maxCategoryTotal = Math.max(...byCategory.map(c => c.total), 1)
  const maxRegionTotal = Math.max(...byRegion.map(r => r[1]), 1)

  return (
    <div className="max-w-7xl mx-auto mt-0 px-4 md:px-8 pt-4 pb-16">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-body text-2xl font-black text-gray-900">Finanzas</h1>
        <p className="text-sm text-gray-500 mt-1">{stats.total} productos registrados · {stats.sold} vendidos</p>
      </div>

      {/* ─── Stat Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="bg-gray-50 rounded-xl p-4 md:p-5">
          <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wide">Total publicados</p>
          <p className="text-2xl md:text-3xl font-black text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 md:p-5">
          <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wide">Vendidos</p>
          <p className="text-2xl md:text-3xl font-black text-green-600 mt-1">{stats.sold}</p>
          <p className="text-xs text-gray-400 mt-0.5">{stats.conversionRate}% conversion</p>
        </div>
        <div className="bg-brand-50 rounded-xl p-4 md:p-5">
          <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wide">Valor publicado</p>
          <p className="text-xl md:text-2xl font-black text-brand-600 mt-1">{formatCLP(stats.totalListing)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Prom. {formatCLP(stats.avgListing)}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 md:p-5">
          <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wide">Valor vendido</p>
          <p className="text-xl md:text-2xl font-black text-purple-600 mt-1">{formatCLP(stats.totalSale)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Prom. {formatCLP(stats.avgSale)}</p>
        </div>
      </div>

      {/* ─── Charts Row ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* By Category */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Por categoria</h2>
          <div className="space-y-2.5">
            {byCategory.map(cat => (
              <div key={cat.type}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-gray-700">{PRODUCT_TYPES[cat.type] || cat.type}</span>
                  <span className="text-gray-400">
                    {cat.total} · {cat.sold} vendidos · Prom. {formatCLP(cat.avgPrice)}
                  </span>
                </div>
                <div className="flex gap-0.5 h-2">
                  <div
                    className="bg-brand-500 rounded-full transition-all duration-500"
                    style={{ width: `${(cat.sold / maxCategoryTotal) * 100}%` }}
                  />
                  <div
                    className="bg-brand-100 rounded-full transition-all duration-500"
                    style={{ width: `${((cat.total - cat.sold) / maxCategoryTotal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-brand-500 rounded-full" /> Vendidos</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-brand-100 rounded-full" /> No vendidos</span>
          </div>
        </div>

        {/* By Region */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Por region</h2>
          <div className="space-y-2.5">
            {byRegion.map(([region, count]) => (
              <div key={region}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-gray-700">{region}</span>
                  <span className="text-gray-400">{count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-400 rounded-full transition-all duration-500"
                    style={{ width: `${(count / maxRegionTotal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Historial completo</h2>

          {/* Filters */}
          <div className="space-y-2">
            <div className="flex gap-1.5 overflow-x-auto">
              {(['all', 'sold', 'approved', 'pending', 'rejected', 'archived'] as const).map(f => {
                const count = f === 'all' ? records.length : records.filter(r => r.status === f).length
                return (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === f ? 'bg-gray-900 text-white' : count === 0 ? 'bg-gray-50 text-gray-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {f === 'all' ? 'Todos' : STATUS_LABELS[f] || f}
                    <span className="ml-1 opacity-60">{count}</span>
                  </button>
                )
              })}
            </div>
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Vendedor</th>
                <th className="px-4 py-3 font-medium">Precio pub.</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Precio venta</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Region</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Fecha</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No hay registros
                  </td>
                </tr>
              ) : filtered.map(r => {
                const title = [r.brand, r.model].filter(Boolean).join(' ')
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-900">{title}</span>
                        <span className="block text-xs text-gray-400">{PRODUCT_TYPES[r.product_type] || r.product_type}</span>
                        <span className="block sm:hidden text-xs text-gray-500 mt-0.5">{r.seller_name || r.seller_email || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div>
                        <span className="text-gray-700">{r.seller_name || '—'}</span>
                        {r.seller_email && <span className="block text-xs text-gray-400">{r.seller_email}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-brand-500">
                      {formatCLP(r.listing_price)}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {r.sale_price ? (
                        <div>
                          <span className="font-medium text-green-600">{formatCLP(r.sale_price)}</span>
                          {r.price_difference !== null && r.price_difference !== 0 && (
                            <span className={`block text-xs ${r.price_difference > 0 ? 'text-red-400' : 'text-green-400'}`}>
                              {r.price_difference > 0 ? '-' : '+'}{formatCLP(Math.abs(r.price_difference))}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">{r.region}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">
                      {new Date(r.listed_at).toLocaleDateString('es-CL')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Table footer summary */}
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t bg-gray-50/50 flex items-center justify-between text-xs text-gray-500">
            <span>{filtered.length} registros</span>
            <div className="flex gap-4">
              <span>Total pub: <span className="font-bold text-gray-700">{formatCLP(filtered.reduce((s, r) => s + r.listing_price, 0))}</span></span>
              <span className="hidden sm:inline">Total venta: <span className="font-bold text-green-600">{formatCLP(filtered.filter(r => r.sale_price).reduce((s, r) => s + (r.sale_price || 0), 0))}</span></span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
