'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_TYPES } from '@/lib/constants'
import AdminTableSkeleton from '@/components/skeletons/AdminTableSkeleton'
import {
  loadCookieConsentSummary,
  type CookieConsentSummary,
} from '@/lib/admin-consent-metrics'
import {
  formatMetricsDate,
  METRICS_PERIODS,
  metricsPeriodRange,
  santiagoDay,
  type MetricsPeriod,
} from '@/lib/admin-metrics-period'
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

const HISTORICAL_RPC_DAYS = 36_500

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

interface ContactEvent {
  id: number
  event_name: 'whatsapp_contact' | 'chat_contact'
  user_id: string | null
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

interface IntentEvent {
  id: number
  event_name: string
  user_id: string | null
  created_at: string
  utm_campaign: string | null
  utm_content: string | null
  utm_source: string | null
  utm_medium: string | null
  users: { name: string | null; email: string | null } | null
  products: {
    id: string
    brand: string | null
    model: string | null
    slug: string | null
  } | null
}

interface CampaignFunnelRow {
  campaign: string | null
  content: string | null
  source: string | null
  medium: string | null
  pageviews: number
  product_views: number
  visitors: number
  intents: number
  intent_visitors: number
  anonymous_intents: number
  whatsapp_intents: number
  chat_intents: number
  contacts: number
}

interface ProductFunnelRow {
  product_id: string
  brand: string | null
  model: string | null
  slug: string | null
  price: number
  product_views: number
  visitors: number
  intents: number
  anonymous_intents: number
  contacts: number
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

function pct(part: number, whole: number): string {
  if (whole <= 0) return '—'
  return `${Math.round((part / whole) * 1000) / 10}%`
}

/** vistas → intentos → contactos, the three steps of the contact funnel. */
function FunnelStats({ views, intents, anonymous, contacts }: {
  views: number
  intents: number
  anonymous: number
  contacts: number
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-gray-500">
      <span><b className="text-gray-800">{views}</b> vistas</span>
      <span className="text-gray-300">→</span>
      <span><b className={intents > 0 ? 'text-amber-600' : 'text-gray-400'}>{intents}</b> intentos</span>
      <span className="text-gray-400">({pct(intents, views)})</span>
      <span className="text-gray-300">→</span>
      <span><b className={contacts > 0 ? 'text-green-600' : 'text-gray-400'}>{contacts}</b> contactos</span>
      <span className="text-gray-400">({pct(contacts, intents)})</span>
      {anonymous > 0 && (
        <span className="text-amber-700">· {anonymous} sin sesión</span>
      )}
    </div>
  )
}

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
  const [period, setPeriod] = useState<MetricsPeriod>(7)
  const [customDate, setCustomDate] = useState(() => santiagoDay(new Date()))
  const [loading, setLoading] = useState(true)
  const [daily, setDaily] = useState<DailyRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [clicks, setClicks] = useState<ClickEvent[]>([])
  const [contactEvents, setContactEvents] = useState<ContactEvent[]>([])
  const [contactCount, setContactCount] = useState(0)
  const [chatCount, setChatCount] = useState(0)
  const [intentEvents, setIntentEvents] = useState<IntentEvent[]>([])
  const [intentCount, setIntentCount] = useState(0)
  const [campaignFunnel, setCampaignFunnel] = useState<CampaignFunnelRow[]>([])
  const [productFunnel, setProductFunnel] = useState<ProductFunnelRow[]>([])
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [consent, setConsent] = useState<CookieConsentSummary>({
    metrics: [], bannerViewers: 0, bannerViews: 0,
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const range = metricsPeriodRange(period, customDate)
      const rpcDays = period === 'all'
        ? HISTORICAL_RPC_DAYS
        : typeof period === 'number' ? period : 1
      const since = range.since
      const sinceDay = range.firstDay
      let contactQuery = supabase
        .from('events')
        .select('id, event_name, user_id, created_at, utm_source, utm_medium, utm_campaign, utm_content, users(name, email), products(id, brand, model, slug)', { count: 'exact' })
        .eq('event_type', 'click')
        .in('event_name', ['whatsapp_contact', 'chat_contact'])
        .order('created_at', { ascending: false })
        .limit(50)
      let chatCountQuery = supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'click')
        .eq('event_name', 'chat_contact')
      let intentQuery = supabase
        .from('events')
        .select('id, event_name, user_id, created_at, utm_campaign, utm_content, utm_source, utm_medium, users(name, email), products(id, brand, model, slug)', { count: 'exact' })
        .eq('event_type', 'click')
        .like('event_name', 'contact_intent_%')
        .order('created_at', { ascending: false })
        .limit(50)
      let clickQuery = supabase
        .from('events')
        .select('id, event_name, category, created_at, users(name), products(brand, model)')
        .eq('event_type', 'click')
        .neq('event_name', 'whatsapp_contact')
        .neq('event_name', 'chat_contact')
        .not('event_name', 'like', 'cookie_consent_%')
        .not('event_name', 'like', 'contact_intent_%')
        .order('created_at', { ascending: false })
        .limit(50)
      let activityQuery = supabase
        .from('events')
        .select('id, event_type, event_name, path, created_at, users(name)')
        .in('event_type', ['login', 'signup', 'invite_open'])
        .order('created_at', { ascending: false })
        .limit(20)
      if (since) {
        contactQuery = contactQuery.gte('created_at', since)
        intentQuery = intentQuery.gte('created_at', since)
        chatCountQuery = chatCountQuery.gte('created_at', since)
        clickQuery = clickQuery.gte('created_at', since)
        activityQuery = activityQuery.gte('created_at', since)
      }

      const dailyQuery = period === 'custom'
        ? supabase.rpc('admin_daily_visits_since', { p_since: sinceDay! })
        : supabase.rpc('admin_daily_visits', { p_days: rpcDays })
      const categoryQuery = period === 'custom'
        ? supabase.rpc('admin_category_views_since', { p_since: sinceDay! })
        : supabase.rpc('admin_category_views', { p_days: rpcDays })
      const topProductsQuery = period === 'custom'
        ? supabase.rpc('admin_top_products_since', { p_since: sinceDay!, p_limit: 10 })
        : supabase.rpc('admin_top_products', { p_days: rpcDays, p_limit: 10 })

      const [
        dailyRes, catRes, clickRes, contactRes, chatCountRes, topRes, actRes,
        consentRes, intentRes, campaignFunnelRes, productFunnelRes,
      ] = await Promise.all([
        dailyQuery,
        categoryQuery,
        clickQuery,
        contactQuery,
        chatCountQuery,
        topProductsQuery,
        activityQuery,
        loadCookieConsentSummary(supabase, since),
        intentQuery,
        supabase.rpc('admin_contact_funnel', { p_since: since }),
        supabase.rpc('admin_product_funnel', { p_since: since, p_limit: 15 }),
      ])
      if (cancelled) return
      const dailyRows = ((dailyRes.data as DailyRow[]) || [])
        .filter(row => !sinceDay || row.day >= sinceDay)
      setDaily(dailyRows)
      setCategories((catRes.data as CategoryRow[]) || [])
      setClicks((clickRes.data as unknown as ClickEvent[]) || [])
      setContactEvents((contactRes.data as unknown as ContactEvent[]) || [])
      setContactCount(contactRes.count ?? 0)
      setChatCount(chatCountRes.count ?? 0)
      setTopProducts((topRes.data as TopProductRow[]) || [])
      setActivity((actRes.data as unknown as ActivityRow[]) || [])
      setConsent(consentRes)
      setIntentEvents((intentRes.data as unknown as IntentEvent[]) || [])
      setIntentCount(intentRes.count ?? 0)
      setCampaignFunnel((campaignFunnelRes.data as CampaignFunnelRow[]) || [])
      setProductFunnel((productFunnelRes.data as ProductFunnelRow[]) || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [customDate, period])

  // A daily chart remains readable for short periods. Historical data is
  // grouped by month so it can keep growing without producing hundreds of bars.
  const selectedRange = metricsPeriodRange(period, customDate)
  const chartIsMonthly = period === 'all'
    || (period === 'custom' && (selectedRange.calendarDays ?? 0) > 90)
  const chartRows = useMemo<ChartRow[]>(() => {
    if (chartIsMonthly) {
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
    const firstDay = selectedRange.firstDay
    const calendarDays = selectedRange.calendarDays
    if (!firstDay || !calendarDays) return out
    const firstDayMs = Date.parse(`${firstDay}T00:00:00Z`)
    for (let i = 0; i < calendarDays; i++) {
      const key = new Date(firstDayMs + i * 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 10)
      const row = byDay.get(key)
      out.push({
        key,
        label: `${key.slice(8, 10)}/${key.slice(5, 7)}`,
        visits: Number(row?.visits ?? 0),
        uniques: Number(row?.uniques ?? 0),
      })
    }
    return out
  }, [chartIsMonthly, daily, selectedRange.calendarDays, selectedRange.firstDay])

  const today = santiagoDay(new Date())
  const todayRow = daily.find(d => d.day === today)
  const totalVisits = daily.reduce((s, d) => s + Number(d.visits), 0)
  // Sum of daily uniques (a returning visitor counts once per day, not once per period)
  const totalUniques = daily.reduce((s, d) => s + Number(d.uniques), 0)
  const maxVisits = Math.max(...chartRows.map(d => Number(d.visits)), 1)
  const totalCatViews = categories.reduce((s, c) => s + Number(c.views), 0)
  const customDateLabel = formatMetricsDate(selectedRange.firstDay || customDate)
  const periodLabel = period === 'all'
    ? 'histórico'
    : period === 'custom' ? `desde el ${customDateLabel}` : `últimos ${period} días`
  const whatsappCount = Math.max(contactCount - chatCount, 0)
  const anonymousIntents = campaignFunnel.reduce((sum, row) => sum + Number(row.anonymous_intents), 0)
  const acceptedConsent = consent.metrics.find(row => row.decision === 'granted')
  const deniedConsent = consent.metrics.find(row => row.decision === 'denied')
  const acceptedVisitors = Number(acceptedConsent?.unique_visitors ?? 0)
  const deniedVisitors = Number(deniedConsent?.unique_visitors ?? 0)
  const decidedVisitors = acceptedVisitors + deniedVisitors
  // Rate over visitors the dialog was actually shown to. Impressions only
  // exist from the deploy that added cookie_consent_view onward, so older
  // periods fall back to the decision-only split and say so.
  const hasBannerViews = consent.bannerViewers > 0
  const consentVisitors = hasBannerViews ? consent.bannerViewers : decidedVisitors
  const undecidedVisitors = Math.max(consentVisitors - decidedVisitors, 0)
  const consentAcceptanceRate = consentVisitors > 0
    ? Math.round((acceptedVisitors / consentVisitors) * 100)
    : 0

  if (loading) return <AdminTableSkeleton />

  const kpis = [
    { label: 'Visitas hoy', value: Number(todayRow?.visits ?? 0) },
    { label: 'Únicos hoy', value: Number(todayRow?.uniques ?? 0) },
    {
      label: period === 'all' ? 'Visitas históricas' : period === 'custom' ? `Visitas desde ${customDateLabel}` : `Visitas ${period}d`,
      value: totalVisits,
    },
    {
      label: period === 'all' ? 'Únicos históricos' : period === 'custom' ? `Únicos desde ${customDateLabel}` : `Únicos ${period}d`,
      value: totalUniques,
    },
    {
      label: period === 'all' ? 'Intentos históricos' : period === 'custom' ? `Intentos desde ${customDateLabel}` : `Intentos ${period}d`,
      value: intentCount,
      color: 'text-amber-600',
    },
    {
      label: period === 'all' ? 'Contactos históricos' : period === 'custom' ? `Contactos desde ${customDateLabel}` : `Contactos ${period}d`,
      value: contactCount,
      color: 'text-green-600',
    },
  ]

  return (
    <div className="max-w-7xl mx-auto mt-0 px-4 md:px-8 pt-4 pb-16">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-body text-2xl font-black text-gray-900">Métricas</h1>
          <p className="text-sm text-gray-500 mt-1">Observabilidad del sitio — sin visitas de admins</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <div className="flex flex-wrap justify-end gap-1.5">
            {METRICS_PERIODS.map(option => (
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
          {period === 'custom' && (
            <label className="ml-1 inline-flex items-center gap-2 text-xs font-medium text-gray-600">
              <span>Desde</span>
              <input
                type="date"
                value={customDate}
                max={today}
                onChange={event => setCustomDate(event.target.value || today)}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-brand-500"
              />
            </label>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
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
            {chartIsMonthly ? 'Visitas mensuales' : 'Visitas diarias'}
          </h2>
          <div className="flex items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-100 inline-block" /> Visitas</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-500 inline-block" /> Únicos</span>
          </div>
        </div>
        <div className="h-40 overflow-x-auto pt-8">
          <div className={`flex h-full items-end ${chartIsMonthly ? 'min-w-max gap-3' : 'gap-1'}`}>
            {chartRows.map(row => {
              const visits = Number(row.visits)
              const uniques = Number(row.uniques)
              const hVisits = (visits / maxVisits) * 100
              const hUniques = (uniques / maxVisits) * 100
              return (
                <div key={row.key} className={`${chartIsMonthly ? 'w-14 shrink-0' : 'flex-1'} group relative flex h-full flex-col justify-end`}>
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
        {/* Buyer intent — successful WhatsApp handoffs and first internal messages */}
        <SectionCard
          title="Contactos de compradores"
          subtitle={`WhatsApp y chat interno · ${periodLabel}`}
          right={(
            <span className="text-right text-[10px] font-bold leading-tight text-gray-500 shrink-0">
              <span className="block text-xs font-black text-green-700">{contactCount} en total</span>
              {whatsappCount} WhatsApp · {chatCount} chat
            </span>
          )}
        >
          {contactEvents.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">Sin contactos en este período.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {contactEvents.map(click => {
                const product = [click.products?.brand, click.products?.model]
                  .filter(Boolean).join(' ') || 'Producto eliminado'
                const who = click.users?.name || click.users?.email || 'Anónimo'
                const isChat = click.event_name === 'chat_contact'
                const channel = isChat ? 'Chat' : 'WhatsApp'
                const href = click.products
                  ? `/producto/${click.products.slug || click.products.id}`
                  : '/admin/publicaciones'
                const campaign = click.utm_campaign || click.utm_source
                const source = [click.utm_source, click.utm_medium].filter(Boolean).join(' / ')
                return (
                  <li key={click.id} className={`px-5 py-2.5 transition-colors ${isChat ? 'bg-sky-50/40 hover:bg-sky-50' : 'bg-green-50/40 hover:bg-green-50'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full ring-4 shrink-0 ${isChat ? 'bg-sky-500 ring-sky-100' : 'bg-green-500 ring-green-100'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">
                            {who}
                            <span className={`ml-2 text-[9px] font-black uppercase tracking-wide ${isChat ? 'text-sky-600' : 'text-green-600'}`}>
                              {channel}
                            </span>
                          </p>
                          <Link
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`block text-[11px] font-medium hover:underline truncate ${isChat ? 'text-sky-700' : 'text-green-700'}`}
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

        {/* Contact intent — the click, recorded before the login gate */}
        <SectionCard
          title="Intentos de contacto"
          subtitle={`Clic en WhatsApp o chat, antes del login · ${periodLabel}`}
          right={(
            <span className="text-right text-[10px] font-bold leading-tight text-gray-500 shrink-0">
              <span className="block text-xs font-black text-amber-600">{intentCount} intentos</span>
              {anonymousIntents} sin sesión
            </span>
          )}
        >
          {intentEvents.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">Sin intentos en este período.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {intentEvents.map(intent => {
                const product = [intent.products?.brand, intent.products?.model]
                  .filter(Boolean).join(' ') || 'Producto eliminado'
                const isChat = intent.event_name === 'contact_intent_chat'
                const anonymous = intent.user_id === null
                const who = intent.users?.name || intent.users?.email || 'Anónimo'
                const href = intent.products
                  ? `/producto/${intent.products.slug || intent.products.id}`
                  : '/admin/publicaciones'
                const campaign = intent.utm_campaign || intent.utm_source
                const source = [intent.utm_source, intent.utm_medium].filter(Boolean).join(' / ')
                return (
                  <li key={intent.id} className="px-5 py-2.5 transition-colors hover:bg-amber-50/60">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full ring-4 shrink-0 ${isChat ? 'bg-sky-400 ring-sky-100' : 'bg-amber-500 ring-amber-100'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">
                            {who}
                            <span className={`ml-2 text-[9px] font-black uppercase tracking-wide ${isChat ? 'text-sky-600' : 'text-amber-600'}`}>
                              {isChat ? 'Chat' : 'WhatsApp'}
                            </span>
                            {anonymous && (
                              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700">
                                Sin sesión
                              </span>
                            )}
                          </p>
                          <Link
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[11px] font-medium text-gray-600 hover:underline truncate"
                          >
                            Quiso contactar por {product}
                          </Link>
                          {campaign && (
                            <p className="truncate text-[10px] font-medium text-gray-500">
                              {campaign}
                              {intent.utm_content ? ` · ${intent.utm_content}` : ''}
                              {source ? ` · ${source}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{timeAgo(intent.created_at)}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>

        {/* Funnel by campaign / ad */}
        <SectionCard
          title="Funnel por campaña"
          subtitle={`Vistas → intentos → contactos, por anuncio · ${periodLabel}`}
        >
          {campaignFunnel.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">Sin datos de campaña en este período.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {campaignFunnel.map((row, index) => {
                const label = row.campaign || row.source || '(directo / sin UTM)'
                const source = [row.source, row.medium].filter(Boolean).join(' / ')
                return (
                  <li key={`${row.campaign}-${row.content}-${row.source}-${row.medium}-${index}`} className="px-5 py-2.5">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {label}
                      {row.content && <span className="ml-1.5 text-xs font-medium text-gray-500">{row.content}</span>}
                    </p>
                    {source && <p className="text-[10px] font-medium text-gray-400 truncate">{source}</p>}
                    <FunnelStats
                      views={Number(row.product_views)}
                      intents={Number(row.intents)}
                      anonymous={Number(row.anonymous_intents)}
                      contacts={Number(row.contacts)}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>

        {/* Funnel by product */}
        <SectionCard
          title="Funnel por producto"
          subtitle={`Dónde se cae la intención · ${periodLabel}`}
        >
          {productFunnel.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">Sin datos de producto en este período.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {productFunnel.map(row => {
                const title = [row.brand, row.model].filter(Boolean).join(' ') || 'Sin título'
                return (
                  <li key={row.product_id} className="px-5 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/producto/${row.slug || row.product_id}`}
                        className="text-sm font-bold text-gray-900 hover:text-brand-500 truncate"
                      >
                        {title}
                      </Link>
                      <span className="text-[11px] font-medium text-gray-400 shrink-0">
                        ${Number(row.price).toLocaleString('es-CL')}
                      </span>
                    </div>
                    <FunnelStats
                      views={Number(row.product_views)}
                      intents={Number(row.intents)}
                      anonymous={Number(row.anonymous_intents)}
                      contacts={Number(row.contacts)}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Consentimiento de cookies"
          subtitle={`${hasBannerViews ? 'Sobre quienes vieron el diálogo' : 'Última decisión por visitante'} · ${periodLabel}`}
          right={consentVisitors > 0 ? (
            <span className="text-right text-[10px] font-bold leading-tight text-gray-500 shrink-0">
              <span className="block text-xs font-black text-brand-600">{consentAcceptanceRate}% acepta</span>
              {hasBannerViews ? `${consent.bannerViewers} lo vieron` : `${consentVisitors} decidieron`}
            </span>
          ) : undefined}
        >
          {consentVisitors === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">Sin decisiones en este período.</p>
          ) : (
            <div className="p-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-brand-600">Aceptaron</p>
                  <p className="mt-1 text-2xl font-black text-brand-600">{acceptedVisitors}</p>
                  <p className="mt-1 text-[11px] text-brand-700/70">
                    {Number(acceptedConsent?.decisions ?? 0)} decisiones
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">No</p>
                  <p className="mt-1 text-2xl font-black text-gray-700">{deniedVisitors}</p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {Number(deniedConsent?.decisions ?? 0)} decisiones
                  </p>
                </div>
                <div className={`rounded-xl border p-4 ${hasBannerViews ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-wider ${hasBannerViews ? 'text-amber-700' : 'text-gray-400'}`}>
                    Sin decidir
                  </p>
                  <p className={`mt-1 text-2xl font-black ${hasBannerViews ? 'text-amber-700' : 'text-gray-400'}`}>
                    {hasBannerViews ? undecidedVisitors : '—'}
                  </p>
                  <p className={`mt-1 text-[11px] ${hasBannerViews ? 'text-amber-700/70' : 'text-gray-400'}`}>
                    {hasBannerViews ? `${consent.bannerViews} impresiones` : 'sin impresiones'}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-gray-200" aria-label={`${consentAcceptanceRate}% de aceptación`}>
                <div className="h-full bg-brand-500" style={{ width: `${(acceptedVisitors / consentVisitors) * 100}%` }} />
                <div className="h-full bg-gray-500" style={{ width: `${(deniedVisitors / consentVisitors) * 100}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[11px] font-medium text-gray-500">
                <span>{consentAcceptanceRate}% acepta</span>
                {hasBannerViews && (
                  <span>{Math.round((undecidedVisitors / consentVisitors) * 100)}% ignora el diálogo</span>
                )}
              </div>

              {!hasBannerViews && (
                <p className="mt-3 text-[11px] leading-4 text-gray-400">
                  Este período no tiene impresiones registradas: el porcentaje sale
                  sólo de quienes decidieron, no de quienes vieron el diálogo.
                </p>
              )}
            </div>
          )}
        </SectionCard>

        {/* Category views — icon rows with catalog/product split + share */}
        <SectionCard
          title="Vistas por categoría"
          subtitle={`Catálogo y páginas de producto · ${periodLabel}`}
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
        <SectionCard title="Clicks en la landing" subtitle={`Últimos clicks · ${periodLabel}`}>
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
        <SectionCard title="Actividad reciente" subtitle={`Logins, registros e invitaciones · ${periodLabel}`}>
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
