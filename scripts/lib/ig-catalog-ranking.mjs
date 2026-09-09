const DAY_MS = 86_400_000

export const TRENDING_CONFIG = Object.freeze({
  version: 'recency-views-v1',
  freshnessWeight: 0.5,
  popularityWeight: 0.5,
  freshnessHalfLifeDays: 7,
  viewsWindowDays: 7,
  recencyField: 'created_at',
  viewsMetric: 'distinct_visitor_per_product_in_window',
})

/**
 * Private analytics are read server-side only. Never return/export visitor IDs.
 * A missing/denied analytics query is an error, not an invented zero-view count.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string[]} productIds
 * @param {Date} now
 */
export async function fetchRecentProductViews(client, productIds, now) {
  if (!Number.isFinite(now.getTime())) throw new Error('Fecha de ranking inválida.')
  const until = now.toISOString()
  const since = new Date(now.getTime() - TRENDING_CONFIG.viewsWindowDays * DAY_MS).toISOString()
  const counts = new Map(productIds.map(id => [id, 0]))
  const ids = [...counts.keys()]
  let ignoredAnonymousEvents = 0
  for (let start = 0; start < ids.length; start += 100) {
    const chunk = ids.slice(start, start + 100)
    const visitors = new Map(chunk.map(id => [id, new Set()]))
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.from('events')
        .select('product_id, visitor_id')
        .eq('event_type', 'product_view')
        .in('product_id', chunk)
        .gte('created_at', since)
        .lt('created_at', until)
        .order('id', { ascending: true })
        .range(offset, offset + 999)
      if (error || !Array.isArray(data)) throw new Error('No se pudieron consultar las vistas recientes; ranking cancelado.')
      for (const event of data) {
        if (!event.visitor_id) { ignoredAnonymousEvents++; continue }
        visitors.get(event.product_id)?.add(event.visitor_id)
      }
      if (data.length < 1000) break
    }
    for (const [id, unique] of visitors) counts.set(id, unique.size)
  }
  return { counts, since, until, ignoredAnonymousEvents }
}

/**
 * Select globally by score; category quotas must not override this ranking.
 * @template {{ id: string, status: string, created_at: string }} T
 * @param {T[]} products
 * @param {Map<string, number>} views
 * @param {Date} now
 */
export function rankTrendingProducts(products, views, now) {
  if (!Number.isFinite(now.getTime())) throw new Error('Fecha de ranking inválida.')
  const active = products.filter(product => product.status === 'approved')
  if (new Set(active.map(product => product.id)).size !== active.length) throw new Error('Productos duplicados en el ranking.')
  const inputs = active.map(product => {
    const createdAt = Date.parse(product.created_at)
    const uniqueViews = views.get(product.id)
    if (!Number.isFinite(createdAt)) throw new Error(`Falta fecha de creación válida: ${product.id}`)
    if (!Number.isSafeInteger(uniqueViews) || uniqueViews < 0) throw new Error(`Faltan vistas válidas: ${product.id}`)
    return { product, createdAt, uniqueViews, ageDays: Math.max(0, (now.getTime() - createdAt) / DAY_MS) }
  })
  const maxViews = inputs.reduce((max, input) => Math.max(max, input.uniqueViews), 0)
  return inputs.map(({ product, createdAt, uniqueViews, ageDays }) => {
    const freshness = 2 ** (-ageDays / TRENDING_CONFIG.freshnessHalfLifeDays)
    const popularity = maxViews === 0 ? 0 : Math.log1p(uniqueViews) / Math.log1p(maxViews)
    return { ...product, ranking: {
      score: 100 * (TRENDING_CONFIG.freshnessWeight * freshness + TRENDING_CONFIG.popularityWeight * popularity),
      freshness, popularity, ageDays, uniqueViews7d: uniqueViews, maxUniqueViews7d: maxViews,
      createdAt: new Date(createdAt).toISOString(),
    } }
  }).sort((a, b) => b.ranking.score - a.ranking.score
    || b.ranking.uniqueViews7d - a.ranking.uniqueViews7d
    || b.ranking.createdAt.localeCompare(a.ranking.createdAt)
    || a.id.localeCompare(b.id))
}
