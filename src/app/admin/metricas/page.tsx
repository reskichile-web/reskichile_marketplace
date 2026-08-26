'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_TYPES } from '@/lib/constants'
import AdminTableSkeleton from '@/components/skeletons/AdminTableSkeleton'
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

interface ChartRow {
  key: string
  label: string
  visits: number
  uniques: number
}

type MetricsPeriod = 'all' | 14 | 30

const HISTORICAL_RPC_DAYS = 36_500
const PERIODS: Array<{ value: MetricsPeriod; label: string }> = [
  { value: 'all', label: 'Histórico' },
  { value: 14, label: '14 días' },
  { value: 30, label: '30 días' },
]

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

interface WhatsappEvent {
  id: number
  created_at: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  users: { name: string | null; email: string | null } | null
  products: {
    id: string
    brand: string | null
    model: string | null
    slug: string | null
  } | null
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

// Standard metric section: emphasized header + fixed-height scrollable body
// so every card in a row keeps the same, tidy size.
function SectionCard({ title, subtitle, right, children }: {
  title: string
  subtitle?: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-body text-base font-black text-gray-900 tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="h-80 overflow-y-auto">{children}</div>
    </div>
  )
}

export default function MetricasPage() {
  const [period, setPeriod] = useState<MetricsPeriod>('all')
  const [loading, setLoading] = useState(true)
  const [daily, setDaily] = useState<DailyRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [clicks, setClicks] = useState<ClickEvent[]>([])
  const [whatsappClicks, setWhatsappClicks] = useState<WhatsappEvent[]>([])
  const [whatsappCount, setWhatsappCount] = useState(0)
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const rpcDays = period === 'all' ? HISTORICAL_RPC_DAYS : period
      const since = period === 'all'
        ? null
        : new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString()
      let whatsappQuery = supabase
        .from('events')
        .select('id, created_at, utm_source, utm_medium, utm_campaign, utm_content, users(name, email), products(id, brand, model, slug)', { count: 'exact' })
        .eq('event_type', 'click')
        .eq('event_name', 'whatsapp_contact')
        .order('created_at', { ascending: false })
        .limit(50)
      if (since) whatsappQuery = whatsappQuery.gte('created_at', since)

      const [dailyRes, catRes, clickRes, whatsappRes, topRes, actRes] = await Promise.all([
        supabase.rpc('admin_daily_visits', { p_days: rpcDays }),
        supabase.rpc('admin_category_views', { p_days: rpcDays }),
        supabase
          .from('events')
          .select('id, event_name, category, created_at, users(name), products(brand, model)')
          .eq('event_type', 'click')
          .neq('event_name', 'whatsapp_contact')
          .order('created_at', { ascending: false })
          .limit(50),
        whatsappQuery,
        supabase.rpc('admin_top_products', { p_days: rpcDays, p_limit: 10 }),
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
      setWhatsappClicks((whatsappRes.data as unknown as WhatsappEvent[]) || [])
      setWhatsappCount(whatsappRes.count ?? 0)
      setTopProducts((topRes.data as TopProductRow[]) || [])
      setActivity((actRes.data as unknown as ActivityRow[]) || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [period])

  // A daily chart remains readable for short periods. Historical data is
  // grouped by month so it can keep growing without producing hundreds of bars.
  const chartRows = useMemo<ChartRow[]>(() => {
    if (period === 'all') {
      const byMonth = new Map<string, ChartRow>()
      for (const row of daily) {
        const key = row.day.slice(0, 7)
        const current = byMonth.get(key) || {
          key,
          label: `${key.slice(5, 7)}/${key.slice(2, 4)}`,
          visits: 0,
          uniques: 0,
        }
        current.visits += Number(row.visits)
        current.uniques += Number(row.uniques)
        byMonth.set(key, current)
      }
      return Array.from(byMonth.values()).sort((a, b) => a.key.localeCompare(b.key))
    }

    const byDay = new Map(daily.map(row => [row.day, row]))
    const out: ChartRow[] = []
    for (let i = period - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const key = santiagoDay(date)
      const row = byDay.get(key)
      out.push({
        key,
        label: `${key.slice(8, 10)}/${key.slice(5, 7)}`,
        visits: Number(row?.visits ?? 0),
        uniques: Number(row?.uniques ?? 0),
      })
    }
    return out
  }, [daily, period])

  const today = santiagoDay(new Date())
  const todayRow = daily.find(d => d.day === today)
  const totalVisits = daily.reduce((s, d) => s + Number(d.visits), 0)
  // Sum of daily uniques (a returning visitor counts once per day, not once per period)
  const totalUniques = daily.reduce((s, d) => s + Number(d.uniques), 0)
  const maxVisits = Math.max(...chartRows.map(d => Number(d.visits)), 1)
  const totalCatViews = categories.reduce((s, c) => s + Number(c.views), 0)
  const periodLabel = period === 'all' ? 'histórico' : `últimos ${period} días`

  if (loading) return <AdminTableSkeleton />

  const kpis = [
    { label: 'Visitas hoy', value: Number(todayRow?.visits ?? 0) },
    { label: 'Únicos hoy', value: Number(todayRow?.uniques ?? 0) },
    { label: period === 'all' ? 'Visitas históricas' : `Visitas ${period}d`, value: totalVisits },
    { label: period === 'all' ? 'Únicos históricos' : `Únicos ${period}d`, value: totalUniques },
    { label: period === 'all' ? 'WhatsApp histórico' : `WhatsApp ${period}d`, value: whatsappCount, color: 'text-green-600' },
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
          {PERIODS.map(option => (
            <button
              key={option.value}
              type="button"
              aria-pressed={period === option.value}
              onClick={() => setPeriod(option.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${period === option.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {kpis.map(kpi => (
          <div key={kpi.label} className={`${CARD} p-5`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{kpi.label}</p>
            <p className={`text-3xl font-black mt-2 ${kpi.color || 'text-brand-500'}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Daily visits chart */}
      <div className={`${CARD} p-5 mb-8`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-body text-base font-black text-gray-900 tracking-tight">
            {period === 'all' ? 'Visitas mensuales' : 'Visitas diarias'}
          </h2>
          <div className="flex items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-100 inline-block" /> Visitas</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-500 inline-block" /> Únicos</span>
          </div>
        </div>
        <div className="h-40 overflow-x-auto pt-8">
          <div className={`flex h-full items-end ${period === 'all' ? 'min-w-max gap-3' : 'gap-1'}`}>
            {chartRows.map(row => {
              const visits = Number(row.visits)
              const uniques = Number(row.uniques)
              const hVisits = (visits / maxVisits) * 100
              const hUniques = (uniques / maxVisits) * 100
              return (
                <div key={row.key} className={`${period === 'all' ? 'w-14 shrink-0' : 'flex-1'} group relative flex h-full flex-col justify-end`}>
                  {/* Hover tooltip */}
                  <div className="hidden group-hover:flex flex-col items-center absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 pointer-events-none">
                    <div className="bg-gray-900 text-white text-[10px] leading-relaxed rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg text-center">
                      <span className="block font-bold">{row.label}</span>
                      <span className="block">{visits} {visits === 1 ? 'vista' : 'vistas'}</span>
                      <span className="block text-brand-300">{uniques} {uniques === 1 ? 'único' : 'únicos'}</span>
                    </div>
                    <div className="w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
                  </div>
                  <div className="relative w-full rounded-t bg-brand-100 group-hover:bg-brand-200 transition-colors" style={{ height: `${Math.max(hVisits, visits > 0 ? 3 : 1)}%` }}>
                    <div className="absolute bottom-0 left-0 right-0 rounded-t bg-brand-500" style={{ height: `${visits > 0 ? (hUniques / Math.max(hVisits, 1)) * 100 : 0}%` }} />
                  </div>
                  <span className="mt-1 truncate text-center text-[9px] text-gray-400">{row.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* WhatsApp intent — successful handoffs to a seller number */}
        <SectionCard
          title="Contactos por WhatsApp"
          subtitle={`Clics efectivos · ${periodLabel}`}
          right={<span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-black text-green-700 shrink-0">{whatsappCount} en total</span>}
        >
          {whatsappClicks.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">Sin contactos por WhatsApp en este período.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {whatsappClicks.map(click => {
                const product = [click.products?.brand, click.products?.model]
                  .filter(Boolean).join(' ') || 'Producto eliminado'
                const who = click.users?.name || click.users?.email || 'Anónimo'
                const href = click.products
                  ? `/producto/${click.products.slug || click.products.id}`
                  : '/admin/publicaciones'
                const campaign = click.utm_campaign || click.utm_source
                const source = [click.utm_source, click.utm_medium].filter(Boolean).join(' / ')
                return (
                  <li key={click.id} className="px-5 py-2.5 bg-green-50/40 hover:bg-green-50 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-green-100 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{who}</p>
                          <Link
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[11px] font-medium text-green-700 hover:underline truncate"
                          >
                            Contactó por {product}
                          </Link>
                          {campaign && (
                            <p className="truncate text-[10px] font-medium text-gray-500">
                              {campaign}
                              {click.utm_content ? ` · ${click.utm_content}` : ''}
                              {source ? ` · ${source}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{timeAgo(click.created_at)}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>

        {/* Category views — icon rows with catalog/product split + share */}
        <SectionCard
          title="Vistas por categoría"
          subtitle="Catálogo y páginas de producto"
          right={totalCatViews > 0 ? <span className="text-xs text-gray-400 shrink-0">{totalCatViews} en total</span> : undefined}
        >
          {categories.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">Sin datos todavía.</p>
          ) : (
            <div className="px-5 divide-y divide-gray-50">
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
        </SectionCard>

        {/* Landing clicks — recent history */}
        <SectionCard title="Clicks en la landing" subtitle="Historial de los últimos clicks">
          {clicks.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">Sin clicks registrados todavía.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
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
        </SectionCard>

        {/* Top products */}
        <SectionCard title="Top productos por visitas" subtitle={`Más vistos · ${periodLabel}`}>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">Sin vistas de producto todavía.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {topProducts.map((p, i) => {
                  const title = [p.brand, p.model].filter(Boolean).join(' ') || 'Sin título'
                  return (
                    <tr key={p.product_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
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
        </SectionCard>

        {/* Activity feed */}
        <SectionCard title="Actividad reciente" subtitle="Logins, registros e invitaciones abiertas">
          {activity.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">Sin actividad registrada todavía.</p>
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
        </SectionCard>
      </div>
    </div>
  )
}
