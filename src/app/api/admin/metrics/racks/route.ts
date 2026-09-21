import { NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-security'
import { RACK_EVENT_LABELS, RACK_EVENTS, parseRackEventDetail } from '@/lib/rack-analytics'
import { SKI_RACK_PRODUCTS } from '@/lib/ski-rack-products'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface EventRow {
  id: number
  event_type: string
  event_name: string | null
  path: string
  category: string | null
  visitor_id: string | null
  created_at: string
  country: string | null
  city: string | null
  user_agent: string | null
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
}

interface OrderItemRow {
  product_name: string
  quantity: number
  line_total_clp: number
  rack_inventory_id: string | null
  package_snapshot: Record<string, unknown> | null
}

interface OrderRow {
  public_id: string
  order_number: string
  buyer_name: string
  buyer_email: string
  delivery_method: string
  payment_status: string
  fulfillment_status: string
  subtotal_clp: number
  shipping_clp: number
  total_clp: number
  paid_at: string | null
  created_at: string
  order_items: OrderItemRow[]
  refunds: Array<{ amount_clp: number; state: string }>
}

function safeSince(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return 'Dispositivo desconocido'
  const device = /ipad|tablet/i.test(userAgent)
    ? 'Tablet'
    : /mobile|iphone|android/i.test(userAgent) ? 'Móvil' : 'Computador'
  const browser = /edg\//i.test(userAgent)
    ? 'Edge'
    : /chrome|crios/i.test(userAgent)
      ? 'Chrome'
      : /safari/i.test(userAgent) ? 'Safari' : /firefox|fxios/i.test(userAgent) ? 'Firefox' : null
  return browser ? `${device} · ${browser}` : device
}

function eventName(event: EventRow): string {
  if (event.event_type === 'click') return event.event_name || 'rack_event'
  if (event.path === '/ski-rack') return 'rack_catalog_view'
  if (event.path === '/carrito') return 'rack_cart_page_view'
  return 'rack_product_view'
}

function eventSlug(event: EventRow): string | null {
  const detail = parseRackEventDetail(event.category)
  if (detail.slug) return detail.slug
  if (event.path.startsWith('/ski-rack/')) return event.path.slice('/ski-rack/'.length).split('/')[0] || null
  return null
}

function numberDetail(event: EventRow, key: string): number {
  const value = Number(parseRackEventDetail(event.category)[key] || 0)
  return Number.isFinite(value) ? value : 0
}

function snapshotValue(snapshot: Record<string, unknown> | null, key: string): string | null {
  const value = snapshot?.[key]
  return typeof value === 'string' && value ? value : null
}

function sourceLabel(event: EventRow): string {
  if (event.utm_campaign) return event.utm_campaign
  if (event.utm_source) return event.utm_source
  if (!event.referrer) return 'Directo / sin UTM'
  try {
    const hostname = new URL(event.referrer).hostname.replace(/^www\./, '')
    return hostname === 'reskichile.cl' || hostname === 'localhost'
      ? 'Directo / navegación interna'
      : hostname
  } catch {
    return 'Referencia externa'
  }
}

async function loadRackEvents(
  service: ReturnType<typeof createServiceRoleClient>,
  type: 'pageview' | 'click',
  since: string | null,
): Promise<EventRow[]> {
  const pageSize = 1000
  const rows: EventRow[] = []
  for (let from = 0; from < 50_000; from += pageSize) {
    let query = service
      .from('events')
      .select('id, event_type, event_name, path, category, visitor_id, created_at, country, city, user_agent, referrer, utm_source, utm_medium, utm_campaign, utm_content')
      .eq('event_type', type)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)
    query = type === 'pageview'
      ? query.or('path.eq./ski-rack,path.like./ski-rack/%,path.eq./carrito')
      : query.like('event_name', 'rack_%')
    if (since) query = query.gte('created_at', since)
    const result = await query
    if (result.error) throw new Error('rack event metrics query failed')
    const page = (result.data || []) as EventRow[]
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}

export async function GET(request: Request) {
  try {
    await requireAdmin()
    const service = createServiceRoleClient()
    const since = safeSince(new URL(request.url).searchParams.get('since'))

    let orderQuery = service
      .from('orders')
      .select(`
        public_id, order_number, buyer_name, buyer_email, delivery_method,
        payment_status, fulfillment_status, subtotal_clp, shipping_clp,
        total_clp, paid_at, created_at,
        order_items(product_name, quantity, line_total_clp, rack_inventory_id, package_snapshot),
        refunds(amount_clp, state)
      `)
      .in('payment_status', ['authorized', 'partially_refunded', 'refunded'])
      .order('paid_at', { ascending: false })
      .limit(1000)

    if (since) {
      orderQuery = orderQuery.gte('paid_at', since)
    }

    const [pageviews, clicks, orderResult] = await Promise.all([
      loadRackEvents(service, 'pageview', since),
      loadRackEvents(service, 'click', since),
      orderQuery,
    ])
    if (orderResult.error) {
      throw new Error('rack metrics query failed')
    }

    const events = [...pageviews, ...clicks]
    const visibleProducts = SKI_RACK_PRODUCTS.filter(product => product.catalogVisible !== false)
    const visibleSlugs = new Set(visibleProducts.map(product => product.slug))
    const orders = ((orderResult.data || []) as unknown as OrderRow[]).flatMap(order => {
      const rackItems = (order.order_items || []).flatMap(item => {
        const slug = snapshotValue(item.package_snapshot, 'rack_slug')
        if (!item.rack_inventory_id || !slug || !visibleSlugs.has(slug)) return []
        return [{
          name: item.product_name,
          slug,
          size: snapshotValue(item.package_snapshot, 'size'),
          quantity: Number(item.quantity),
          totalClp: Number(item.line_total_clp),
        }]
      })
      return rackItems.length > 0 ? [{ ...order, rackItems }] : []
    })

    const visitors = (rows: EventRow[]) => new Set(rows.map(row => row.visitor_id).filter(Boolean)).size
    const catalogViews = pageviews.filter(row => row.path === '/ski-rack')
    const productViews = pageviews.filter(row => row.path.startsWith('/ski-rack/'))
    const cartPageViews = pageviews.filter(row => row.path === '/carrito')
    const addEvents = clicks.filter(row => row.event_name === RACK_EVENTS.cartAdd)
    const cartOpenEvents = clicks.filter(row => row.event_name === RACK_EVENTS.cartOpen)
    const checkoutEvents = clicks.filter(row => row.event_name === RACK_EVENTS.checkoutView)
    const contactEvents = clicks.filter(row => row.event_name === RACK_EVENTS.checkoutContact)
    const shippingEvents = clicks.filter(row => row.event_name === RACK_EVENTS.checkoutShipping)
    const paymentEvents = clicks.filter(row => row.event_name === RACK_EVENTS.paymentStart)
    const purchaseEvents = clicks.filter(row => row.event_name === RACK_EVENTS.purchase)
    const cartVisitors = new Set(
      [...cartPageViews, ...cartOpenEvents].map(row => row.visitor_id).filter(Boolean)
    ).size

    const productStats = new Map(visibleProducts.map(product => [product.slug, {
      slug: product.slug,
      name: product.name,
      views: 0,
      viewVisitors: new Set<string>(),
      addEvents: 0,
      addVisitors: new Set<string>(),
      unitsAdded: 0,
      orders: new Set<string>(),
      unitsSold: 0,
      revenueClp: 0,
      sizes: {} as Record<string, { added: number; sold: number }>,
    }]))

    for (const event of productViews) {
      const slug = eventSlug(event)
      const product = slug ? productStats.get(slug) : null
      if (!product) continue
      product.views += 1
      if (event.visitor_id) product.viewVisitors.add(event.visitor_id)
    }
    for (const event of addEvents) {
      const detail = parseRackEventDetail(event.category)
      const product = detail.slug ? productStats.get(detail.slug) : null
      if (!product) continue
      const quantity = numberDetail(event, 'qty') || 1
      product.addEvents += 1
      product.unitsAdded += quantity
      if (event.visitor_id) product.addVisitors.add(event.visitor_id)
      if (detail.size) {
        product.sizes[detail.size] ||= { added: 0, sold: 0 }
        product.sizes[detail.size].added += quantity
      }
    }
    for (const order of orders) {
      for (const item of order.rackItems) {
        const product = productStats.get(item.slug)
        if (!product) continue
        product.orders.add(order.public_id)
        product.unitsSold += item.quantity
        product.revenueClp += item.totalClp
        if (item.size) {
          product.sizes[item.size] ||= { added: 0, sold: 0 }
          product.sizes[item.size].sold += item.quantity
        }
      }
    }

    const normalizedEvents = events
      .map(event => {
        const name = eventName(event)
        return {
          id: event.id,
          name,
          label: RACK_EVENT_LABELS[name] || name,
          createdAt: event.created_at,
          path: event.path,
          detail: parseRackEventDetail(event.category),
          visitorKey: event.visitor_id ? event.visitor_id.slice(-6) : null,
          location: [event.city, event.country].filter(Boolean).join(', ') || null,
          device: deviceLabel(event.user_agent),
          source: event.utm_source || null,
          campaign: event.utm_campaign || null,
          content: event.utm_content || null,
          medium: event.utm_medium || null,
        }
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const journeysByVisitor = new Map<string, EventRow[]>()
    for (const event of events) {
      if (!event.visitor_id) continue
      const current = journeysByVisitor.get(event.visitor_id) || []
      current.push(event)
      journeysByVisitor.set(event.visitor_id, current)
    }
    const journeys = Array.from(journeysByVisitor.entries()).map(([visitorId, rows]) => {
      const chronological = rows.sort((a, b) => (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ))
      const latest = chronological[chronological.length - 1]
      const attributed = chronological.find(row => row.utm_source || row.utm_campaign)
      const names = chronological.map(eventName)
      return {
        visitorKey: visitorId.slice(-6),
        firstAt: chronological[0].created_at,
        lastAt: latest.created_at,
        eventCount: chronological.length,
        location: [latest.city, latest.country].filter(Boolean).join(', ') || null,
        device: deviceLabel(latest.user_agent),
        source: attributed?.utm_source || null,
        campaign: attributed?.utm_campaign || null,
        steps: Array.from(new Set(names)).map(name => ({
          name,
          label: RACK_EVENT_LABELS[name] || name,
        })),
        purchased: names.includes(RACK_EVENTS.purchase),
      }
    }).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())

    const sourceStats = new Map<string, { events: number; visitors: Set<string>; carts: number; checkouts: number }>()
    for (const event of events) {
      const label = sourceLabel(event)
      const current = sourceStats.get(label) || { events: 0, visitors: new Set<string>(), carts: 0, checkouts: 0 }
      current.events += 1
      if (event.visitor_id) current.visitors.add(event.visitor_id)
      if (event.event_name === RACK_EVENTS.cartAdd) current.carts += 1
      if (event.event_name === RACK_EVENTS.checkoutView) current.checkouts += 1
      sourceStats.set(label, current)
    }

    const purchaseUnits = orders.reduce((sum, order) => (
      sum + order.rackItems.reduce((itemSum, item) => itemSum + item.quantity, 0)
    ), 0)
    const productRevenueClp = orders.reduce((sum, order) => (
      sum + order.rackItems.reduce((itemSum, item) => itemSum + item.totalClp, 0)
    ), 0)
    const totalRevenueClp = orders.reduce((sum, order) => sum + Number(order.total_clp), 0)
    const shippingRevenueClp = orders.reduce((sum, order) => sum + Number(order.shipping_clp), 0)
    const refundedClp = orders.reduce((sum, order) => (
      sum + (order.refunds || [])
        .filter(refund => refund.state === 'succeeded')
        .reduce((refundSum, refund) => refundSum + Number(refund.amount_clp), 0)
    ), 0)

    return NextResponse.json({
      summary: {
        trackedEvents: events.length,
        catalogViews: catalogViews.length,
        catalogVisitors: visitors(catalogViews),
        productViews: productViews.length,
        productVisitors: visitors(productViews),
        addEvents: addEvents.length,
        addVisitors: visitors(addEvents),
        unitsAdded: addEvents.reduce((sum, event) => sum + (numberDetail(event, 'qty') || 1), 0),
        cartOpens: cartPageViews.length + cartOpenEvents.length,
        cartVisitors,
        checkoutStarts: checkoutEvents.length,
        checkoutVisitors: visitors(checkoutEvents),
        contactCompletions: contactEvents.length,
        shippingQuotes: shippingEvents.length,
        paymentStarts: paymentEvents.length,
        paymentVisitors: visitors(paymentEvents),
        trackedPurchases: purchaseEvents.length,
        purchases: orders.length,
        purchaseUnits,
        productRevenueClp,
        shippingRevenueClp,
        totalRevenueClp,
        refundedClp,
        netRevenueClp: Math.max(0, totalRevenueClp - refundedClp),
        averageOrderClp: orders.length ? Math.round(totalRevenueClp / orders.length) : 0,
        refundedOrders: orders.filter(order => order.payment_status === 'refunded').length,
      },
      products: Array.from(productStats.values()).map(product => ({
        slug: product.slug,
        name: product.name,
        views: product.views,
        viewVisitors: product.viewVisitors.size,
        addEvents: product.addEvents,
        addVisitors: product.addVisitors.size,
        unitsAdded: product.unitsAdded,
        orders: product.orders.size,
        unitsSold: product.unitsSold,
        revenueClp: product.revenueClp,
        sizes: product.sizes,
      })).sort((a, b) => b.unitsSold - a.unitsSold || b.unitsAdded - a.unitsAdded || b.views - a.views),
      sources: Array.from(sourceStats.entries()).map(([label, value]) => ({
        label,
        events: value.events,
        visitors: value.visitors.size,
        carts: value.carts,
        checkouts: value.checkouts,
      })).sort((a, b) => b.visitors - a.visitors).slice(0, 12),
      journeys: journeys.slice(0, 20),
      recentEvents: normalizedEvents.slice(0, 50),
      orders: orders.slice(0, 20).map(order => ({
        publicId: order.public_id,
        orderNumber: order.order_number,
        buyerName: order.buyer_name,
        buyerEmail: order.buyer_email,
        deliveryMethod: order.delivery_method,
        paymentStatus: order.payment_status,
        fulfillmentStatus: order.fulfillment_status,
        subtotalClp: Number(order.subtotal_clp),
        shippingClp: Number(order.shipping_clp),
        totalClp: Number(order.total_clp),
        paidAt: order.paid_at || order.created_at,
        items: order.rackItems,
      })),
    }, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json(
      { error: known.message, code: known.code },
      { status: known.status, headers: { 'Cache-Control': 'no-store, private' } }
    )
  }
}
