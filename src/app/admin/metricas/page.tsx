'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_TYPES } from '@/lib/constants'
import AdminTableSkeleton from '@/components/skeletons/AdminTableSkeleton'
import RecentMessagesCard from '@/components/admin/RecentMessagesCard'
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
  otros: GiMountaintop,
}

interface DailyRow {
  day: string // YYYY-MM-DD (America/Santiago)
  visits: number
  uniques: number
}

interface CategoryRow {
  category: string
  views: number
  catalog_views: number
  product_views: number
}

interface ClickEvent {
  id: number
  event_name: string | null
  category: string | null
  created_at: string
  users: { name: string | null } | null
  products: { brand: string | null; model: string | null } | null
}

interface TopProductRow {
  product_id: string
  brand: string | null
  model: string | null
  slug: string | null
  views: number
}

interface ActivityRow {
  id: number
  event_type: string
  event_name: string | null
  path: string
  created_at: string
  users: { name: string | null } | null
}

const CLICK_LABELS: Record<string, string> = {
  hero_explorar: 'Hero: Explorar ofertas',
  hero_publicar: 'Hero: Publicar equipo',
  category_marketplace: 'Categoría → Marketplace',
  category_vender: 'Categoría → Vender',
  category_descubre: 'Categoría → Descubre (IA)',
  product_card: 'Card de producto (home)',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `hace ${hrs} h`
  const days = Math.floor(hrs / 24)
  return `hace ${days} d`
}

// YYYY-MM-DD for a date in America/Santiago (matches the RPC's day column)
function santiagoDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
}

function activityLabel(e: ActivityRow): string {
  const who = e.users?.name || 'Anónimo'
  if (e.event_type === 'login') return `Inicio de sesión — ${who}`
  if (e.event_type === 'signup' && e.event_name === 'invite_redeem') return `Registro por invitación — ${who}`
  if (e.event_type === 'signup') return `Registro nuevo — ${who}`
  if (e.event_type === 'invite_open') return `Invitación abierta (${e.event_name ?? '?'})`
  return e.event_type
}

// White card with the standard admin border
const CARD = 'bg-white rounded-xl border border-gray-200'

export default function MetricasPage() {
  const [days, setDays] = useState<14 | 30>(14)
  const [loading, setLoading] = useState(true)
  const [daily, setDaily] = useState<DailyRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [clicks, setClicks] = useState<ClickEvent[]>([])
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const [dailyRes, catRes, clickRes, topRes, actRes] = await Promise.all([
        supabase.rpc('admin_daily_visits', { p_days: days }),
        supabase.rpc('admin_category_views', { p_days: days }),
        supabase
          .from('events')
          .select('id, event_name, category, created_at, users(name), products(brand, model)')
          .eq('event_type', 'click')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.rpc('admin_top_products', { p_days: days, p_limit: 10 }),
        supabase
          .from('events')
          .select('id, event_type, event_name, path, created_at, users(name)')
          .in('event_type', ['login', 'signup', 'invite_open'])
          .order('created_at', { ascending: false })
          .limit(20),
      ])
      if (cancelled) return
      setDaily((dailyRes.data as DailyRow[]) || [])
      setCategories((catRes.data as CategoryRow[]) || [])
      setClicks((clickRes.data as unknown as ClickEvent[]) || [])
      setTopProducts((topRes.data as TopProductRow[]) || [])
      setActivity((actRes.data as unknown as ActivityRow[]) || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [days])

  // Fill missing days with zeros so the chart shows a continuous range
  const chartDays = useMemo(() => {
    const byDay = new Map(daily.map(d => [d.day, d]))
    const out: DailyRow[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = santiagoDay(d)
      out.push(byDay.get(key) ?? { day: key, visits: 0, uniques: 0 })
    }
    return out
  }, [daily, days])

  const today = santiagoDay(new Date())
  const todayRow = chartDays.find(d => d.day === today)
  const totalVisits = chartDays.reduce((s, d) => s + Number(d.visits), 0)
  // Sum of daily uniques (a returning visitor counts once per day, not once per period)
  const totalUniques = daily.reduce((s, d) => s + Number(d.uniques), 0)
  const maxVisits = Math.max(...chartDays.map(d => Number(d.visits)), 1)
  const totalCatViews = categories.reduce((s, c) => s + Number(c.views), 0)

  if (loading) return <AdminTableSkeleton />

  const kpis = [
    { label: 'Visitas hoy', value: Number(todayRow?.visits ?? 0) },
    { label: 'Únicos hoy', value: Number(todayRow?.uniques ?? 0) },
    { label: `Visitas ${days}d`, value: totalVisits },
    { label: `Únicos ${days}d`, value: totalUniques },
  ]

  return (
    <div className="max-w-7xl mx-auto mt-0 px-4 md:px-8 pt-4 pb-16">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-body text-2xl font-black text-gray-900">Métricas</h1>
          <p className="text-sm text-gray-500 mt-1">Observabilidad del sitio — sin visitas de admins</p>
        </div>
        <div className="flex gap-1.5">
          {([14, 30] as const).map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${days === d ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {d} días
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {kpis.map(kpi => (
          <div key={kpi.label} className={`${CARD} p-5`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{kpi.label}</p>
            <p className="text-3xl font-black mt-2 text-brand-500">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Daily visits chart */}
      <div className={`${CARD} p-5 mb-8`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-gray-900">Visitas diarias</h2>
          <div className="flex items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-100 inline-block" /> Visitas</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-500 inline-block" /> Únicos</span>
          </div>
        </div>
        <div className="flex items-end gap-1 h-40 pt-8">
          {chartDays.map(d => {
            const visits = Number(d.visits)
            const uniques = Number(d.uniques)
            const hVisits = (visits / maxVisits) * 100
            const hUniques = (uniques / maxVisits) * 100
            const [, m, dd] = d.day.split('-')
            return (
              <div key={d.day} className="flex-1 h-full flex flex-col justify-end relative group">
                {/* Hover tooltip */}
                <div className="hidden group-hover:flex flex-col items-center absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 pointer-events-none">
                  <div className="bg-gray-900 text-white text-[10px] leading-relaxed rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg text-center">
                    <span className="block font-bold">{dd}/{m}</span>
                    <span className="block">{visits} {visits === 1 ? 'vista' : 'vistas'}</span>
                    <span className="block text-brand-300">{uniques} {uniques === 1 ? 'único' : 'únicos'}</span>
                  </div>
                  <div className="w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
                </div>
                <div className="relative w-full rounded-t bg-brand-100 group-hover:bg-brand-200 transition-colors" style={{ height: `${Math.max(hVisits, visits > 0 ? 3 : 1)}%` }}>
                  <div className="absolute bottom-0 left-0 right-0 rounded-t bg-brand-500" style={{ height: `${visits > 0 ? (hUniques / Math.max(hVisits, 1)) * 100 : 0}%` }} />
                </div>
                <span className="text-[9px] text-gray-400 text-center mt-1 truncate">{dd}/{m}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-start">
        {/* Category views — icon rows with catalog/product split + share */}
        <div className={`${CARD} p-5`}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-gray-900">Vistas por categoría</h2>
            {totalCatViews > 0 && <span className="text-xs text-gray-400">{totalCatViews} en total</span>}
          </div>
          {categories.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Sin datos todavía.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {categories.map(c => {
                const Icon = TYPE_ICONS[c.category] || GiMountaintop
                const share = totalCatViews > 0 ? Math.round((Number(c.views) / totalCatViews) * 100) : 0
                return (
                  <div key={c.category} className="flex items-center gap-3 py-2.5">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-brand-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{PRODUCT_TYPES[c.category] || c.category}</p>
                      <p className="text-[11px] text-gray-400">
                        {Number(c.catalog_views)} en catálogo · {Number(c.product_views)} en productos
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-black text-brand-500 leading-tight">{c.views}</p>
                      <p className="text-[10px] text-gray-400">{share}% del total</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Landing clicks — recent history, scrolls after a few rows */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">Clicks en la landing</h2>
            <p className="text-xs text-gray-400 mt-0.5">Historial de los últimos clicks</p>
          </div>
          {clicks.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Sin clicks registrados todavía.</p>
          ) : (
            <ul className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {clicks.map(c => {
                const productTitle = [c.products?.brand, c.products?.model].filter(Boolean).join(' ')
                const detail = productTitle || (c.category ? PRODUCT_TYPES[c.category] || c.category : null)
                return (
                  <li key={c.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {CLICK_LABELS[c.event_name ?? ''] || c.event_name}
                        {detail && <span className="ml-1.5 text-xs font-normal text-gray-400">{detail}</span>}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">{c.users?.name || 'Anónimo'}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{timeAgo(c.created_at)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Top products */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">Top productos por visitas</h2>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Sin vistas de producto todavía.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {topProducts.map((p, i) => {
                  const title = [p.brand, p.model].filter(Boolean).join(' ') || 'Sin título'
                  return (
                    <tr key={p.product_id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-5 py-2.5 w-8 text-gray-300 font-black">{i + 1}</td>
                      <td className="px-2 py-2.5">
                        <Link href={`/producto/${p.slug || p.product_id}`} className="font-medium text-gray-900 hover:text-brand-500">
                          {title}
                        </Link>
                      </td>
                      <td className="px-5 py-2.5 text-right font-black text-brand-500">{p.views}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Activity feed */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">Actividad reciente</h2>
            <p className="text-xs text-gray-400 mt-0.5">Logins, registros e invitaciones abiertas</p>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Sin actividad registrada todavía.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {activity.map(e => (
                <li key={e.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      e.event_type === 'login' ? 'bg-brand-400' : e.event_type === 'signup' ? 'bg-green-500' : 'bg-amber-400'
                    }`} />
                    <span className="text-sm text-gray-800 truncate">{activityLabel(e)}</span>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{timeAgo(e.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent chat activity */}
      <RecentMessagesCard className="mt-6" />
    </div>
  )
}
