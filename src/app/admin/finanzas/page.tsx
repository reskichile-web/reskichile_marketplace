'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { PRODUCT_TYPES, CONDITIONS } from '@/lib/constants'
import AdminTableSkeleton from '@/components/skeletons/AdminTableSkeleton'
import AdminInfiniteScroll from '@/components/admin/AdminInfiniteScroll'
import {
  GiSkis, GiSnowboard, GiSkiBoot, GiWalkingBoot,
  GiSkier, GiWinterGloves, GiMonclerJacket,
  GiArmoredPants, GiLightBackpack,
  GiDuffelBag, GiMountaintop, GiFullMotorcycleHelmet,
  GiProtectionGlasses, GiRadarSweep, GiPhotoCamera,
} from 'react-icons/gi'
import { FaSkiingNordic } from 'react-icons/fa'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TYPE_ICONS: Record<string, any> = {
  esquis: GiSkis,
  snowboards: GiSnowboard,
  botas_esqui: GiSkiBoot,
  botas_snowboard: GiWalkingBoot,
  bastones: GiSkier,
  cascos: GiFullMotorcycleHelmet,
  guantes: GiWinterGloves,
  fijaciones: FaSkiingNordic,
  parkas: GiMonclerJacket,
  pantalones: GiArmoredPants,
  antiparras: GiProtectionGlasses,
  mochilas: GiLightBackpack,
  bolsos: GiDuffelBag,
  equipo_avalanchas: GiRadarSweep,
  camaras_accion: GiPhotoCamera,
  equipos_completos: GiSkis,
  otros: GiMountaintop,
}

interface SoldProduct {
  id: string
  product_type: string
  brand: string
  model: string | null
  condition: string
  region: string
  price: number
  sale_price: number | null
  created_at: string
  updated_at: string
  anon_contact: string | null
  slug: string
  users: { name: string | null; email: string; phone: string | null } | null
}

interface CatalogProduct {
  product_type: string
  status: string
  price: number
}

function formatCLP(n: number) {
  return '$' + n.toLocaleString('es-CL')
}

export default function FinanzasPage() {
  const [sold, setSold] = useState<SoldProduct[]>([])
  const [all, setAll] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [summary, setSummary] = useState({ totalListing: 0, totalSale: 0, soldWithPrice: 0 })
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const loadingRef = useRef(false)
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const load = useCallback(async (offset = 0, append = false) => {
    if (append && loadingRef.current) return
    if (!append) requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    loadingRef.current = true
    setError('')
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ offset: String(offset) })
      if (typeFilter) params.set('type', typeFilter)
      if (debouncedSearch) params.set('search', debouncedSearch)
      const response = await fetch(`/api/admin/finance?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No pudimos cargar finanzas')
      const incoming = (data.sold || []) as SoldProduct[]
      setSold(current => append
        ? [...current, ...incoming.filter(row => !current.some(existing => existing.id === row.id))]
        : incoming)
      if (data.metadata) setAll(data.metadata as CatalogProduct[])
      if (data.summary) setSummary(data.summary)
      setHasMore(Boolean(data.hasMore))
      setNextOffset(Number(data.nextOffset || 0))
      setTotalCount(Number(data.totalCount || 0))
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setError(loadError instanceof Error ? loadError.message : 'No pudimos cargar finanzas')
    } finally {
      if (requestRef.current === controller) {
        setLoading(false)
        setInitialLoading(false)
        setLoadingMore(false)
        loadingRef.current = false
      }
    }
  }, [debouncedSearch, typeFilter])

  useEffect(() => { void load(0) }, [load])

  useEffect(() => () => requestRef.current?.abort(), [])

  const loadMore = useCallback(() => {
    void load(nextOffset, true)
  }, [load, nextOffset])

  // ─── Chart: por categoría ───
  const byCategory = useMemo(() => {
    const map: Record<string, { total: number; sold: number; totalValue: number }> = {}
    all.forEach(r => {
      if (!map[r.product_type]) map[r.product_type] = { total: 0, sold: 0, totalValue: 0 }
      map[r.product_type].total++
      map[r.product_type].totalValue += r.price
      if (r.status === 'sold') map[r.product_type].sold++
    })
    return Object.entries(map)
      .map(([type, d]) => ({
        type,
        ...d,
        notSold: d.total - d.sold,
        avgPrice: Math.round(d.totalValue / d.total),
        soldPct: d.total > 0 ? (d.sold / d.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
  }, [all])

  const filtered = sold

  if (initialLoading) return <AdminTableSkeleton />

  return (
    <div className="max-w-7xl mx-auto mt-0 px-4 md:px-8 pt-4 pb-16">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-body text-2xl font-black text-gray-900">Finanzas</h1>
        <p className="text-sm text-gray-500 mt-1">
          {totalCount} vendidos · {all.filter(r => r.status === 'approved').length} activos en catálogo
        </p>
      </div>

      {/* ─── Category Chart ─── */}
      {error && <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-bold text-gray-900 mb-5">Proporción por categoría</h2>
        <div className="space-y-4">
          {byCategory.map(cat => (
            <div key={cat.type}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  {(() => { const Icon = TYPE_ICONS[cat.type] || GiMountaintop; return <Icon className="w-4 h-4 text-gray-400 shrink-0" /> })()}
                  {PRODUCT_TYPES[cat.type] || cat.type}
                </span>
                <div className="text-right">
                  <span className="text-xs text-gray-400 mr-1.5">Prom. precio</span>
                  <span className="text-sm font-black text-gray-900">{formatCLP(cat.avgPrice)}</span>
                </div>
              </div>
              <div className="relative h-9 rounded-lg overflow-hidden">
                <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <polygon
                    points={`0,0 ${cat.soldPct},0 ${Math.max(cat.soldPct - 3, 0)},100 0,100`}
                    className="fill-brand-500"
                  />
                  <polygon
                    points={`${cat.soldPct},0 100,0 100,100 ${Math.max(cat.soldPct - 3, 0)},100`}
                    className="fill-brand-100"
                  />
                </svg>
                <div className="absolute inset-0 flex">
                  <div className="flex items-center justify-center text-white text-xs font-bold" style={{ width: `${Math.max(cat.soldPct, cat.sold > 0 ? 20 : 0)}%` }}>
                    {cat.sold > 0 && cat.sold}
                  </div>
                  <div className="flex-1 flex items-center justify-center text-brand-600 text-xs font-bold">
                    {cat.notSold > 0 && cat.notSold}
                  </div>
                </div>
              </div>
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
          <div className="flex flex-col sm:flex-row gap-2">
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
              className="border rounded-lg px-3 py-2 text-sm sm:w-40"
            >
              <option value="">Todos los tipos</option>
              {Object.entries(PRODUCT_TYPES).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          {loading && <p className="mt-2 text-xs text-brand-500" role="status">Actualizando resultados…</p>}
        </div>

        <div
          aria-busy={loading}
          className={`overflow-x-auto transition-opacity ${loading ? 'pointer-events-none opacity-50' : ''}`}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Vendedor</th>
                <th className="px-4 py-3 font-medium">Precio pub.</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Precio venta</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Diferencia</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Región</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Publicado</th>
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
                const sellerName = r.users?.name || 'Anónimo'
                const sellerContact = r.users?.email || r.anon_contact || '—'
                const diff = r.sale_price !== null ? r.price - r.sale_price : null
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <a href={`/producto/${r.slug}`} className="font-medium text-gray-900 hover:text-brand-500 transition-colors">
                          {title}
                        </a>
                        <span className="block text-xs text-gray-400">{PRODUCT_TYPES[r.product_type] || r.product_type} · {CONDITIONS[r.condition] || r.condition}</span>
                        <span className="block sm:hidden text-xs text-gray-500 mt-0.5">{sellerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div>
                        <span className="text-gray-700">{sellerName}</span>
                        <span className="block text-xs text-gray-400">{sellerContact}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatCLP(r.price)}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap">
                      {r.sale_price !== null
                        ? <span className="font-bold text-green-600">{formatCLP(r.sale_price)}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap">
                      {diff === null
                        ? <span className="text-gray-300">—</span>
                        : diff === 0
                          ? <span className="text-xs text-gray-400">$0</span>
                          : <span className={`text-xs font-medium ${diff > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                              {diff > 0 ? '-' : '+'}{formatCLP(Math.abs(diff))}
                            </span>
                      }
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">{r.region}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-400 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('es-CL')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t bg-gray-50/50 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <span>{totalCount} ventas</span>
            <div className="flex gap-4">
              <span>Total publicado: <span className="font-bold text-gray-700">{formatCLP(summary.totalListing)}</span></span>
              {summary.soldWithPrice > 0 && (
                <span>Total venta real: <span className="font-bold text-green-600">{formatCLP(summary.totalSale)}</span>
                  <span className="text-gray-400 ml-1">({summary.soldWithPrice}/{totalCount} con precio)</span>
                </span>
              )}
            </div>
          </div>
        )}
        <AdminInfiniteScroll
          hasMore={hasMore}
          loading={loadingMore}
          error={error}
          onLoadMore={loadMore}
          label="Cargando más ventas"
        />
      </div>
    </div>
  )
}
