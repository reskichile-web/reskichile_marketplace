import { describe, expect, it, vi } from 'vitest'
import { fetchRecentProductViews, rankTrendingProducts } from '../scripts/lib/ig-catalog-ranking.mjs'

const now = new Date('2026-09-10T12:00:00Z')
const product = (id: string, ageDays: number, status = 'approved') => ({
  id, status, created_at: new Date(now.getTime() - ageDays * 86_400_000).toISOString(),
})

describe('Catalog recency/popularity ranking', () => {
  it('gives each signal half the score and halves freshness every seven days', () => {
    const ranked = rankTrendingProducts([product('fresh', 0), product('popular', 7), product('old', 14)],
      new Map([['fresh', 0], ['popular', 99], ['old', 0]]), now)
    expect(ranked.map(p => p.id)).toEqual(['popular', 'fresh', 'old'])
    expect(ranked.map(p => p.ranking.score)).toEqual([75, 50, 12.5])
  })

  it('uses logarithmic views so moderate interest plus freshness can beat an old hit', () => {
    const ranked = rankTrendingProducts([product('new', 0), product('hit', 28)], new Map([['new', 9], ['hit', 999]]), now)
    expect(ranked[0].id).toBe('new')
    expect(ranked[0].ranking.score).toBeCloseTo(66.6666667)
    expect(ranked[1].ranking.score).toBe(53.125)
  })

  it('handles a catalog without any views without division by zero', () => {
    const ranked = rankTrendingProducts([product('old', 7), product('new', 0)], new Map([['old', 0], ['new', 0]]), now)
    expect(ranked.map(p => p.ranking.score)).toEqual([50, 25])
    expect(ranked.every(p => p.ranking.popularity === 0)).toBe(true)
  })

  it('excludes sold/paused listings even from the popularity normalization', () => {
    const ranked = rankTrendingProducts([product('live', 0), product('sold', 0, 'sold'), product('paused', 0, 'draft')],
      new Map([['live', 3], ['sold', 9999], ['paused', 9999]]), now)
    expect(ranked).toHaveLength(1)
    expect(ranked[0].ranking.score).toBe(100)
    expect(ranked[0].ranking.maxUniqueViews7d).toBe(3)
  })

  it('uses creation time, not a price reduction or catalog bump', () => {
    const p = { ...product('discounted', 14), catalog_bumped_at: now.toISOString() }
    expect(rankTrendingProducts([p], new Map([['discounted', 0]]), now)[0].ranking.freshness).toBe(0.25)
  })

  it('is deterministic, does not mutate inputs and selects without category quotas', () => {
    const input = [product('b', 0), product('a', 0)]
    const ranked = rankTrendingProducts(input, new Map([['a', 1], ['b', 1]]), now)
    expect(ranked.map(p => p.id)).toEqual(['a', 'b'])
    expect(input.map(p => p.id)).toEqual(['b', 'a'])
    expect(input[0]).not.toHaveProperty('ranking')
  })

  it('rejects missing analytics, invalid dates and duplicate products', () => {
    expect(() => rankTrendingProducts([product('a', 0)], new Map(), now)).toThrow('vistas')
    expect(() => rankTrendingProducts([{ ...product('a', 0), created_at: 'invalid' }], new Map([['a', 0]]), now)).toThrow('fecha')
    expect(() => rankTrendingProducts([product('a', 0), product('a', 0)], new Map([['a', 0]]), now)).toThrow('duplicados')
  })
})

function analyticsMock(pages: Array<{ data: unknown, error: unknown }>) {
  const query = {
    select: vi.fn(), eq: vi.fn(), in: vi.fn(), gte: vi.fn(), lt: vi.fn(), order: vi.fn(), range: vi.fn(),
  }
  for (const method of ['select', 'eq', 'in', 'gte', 'lt', 'order'] as const) query[method].mockReturnValue(query)
  for (const page of pages) query.range.mockResolvedValueOnce(page)
  return { client: { from: vi.fn(() => query) }, query }
}

describe('Private view aggregation', () => {
  it('deduplicates visitors across pages and returns only aggregate counts', async () => {
    const { client, query } = analyticsMock([
      { data: Array.from({ length: 1000 }, () => ({ product_id: 'a', visitor_id: 'visitor-one' })), error: null },
      { data: [
        { product_id: 'a', visitor_id: 'visitor-one' },
        { product_id: 'a', visitor_id: 'visitor-two' },
        { product_id: 'b', visitor_id: 'visitor-one' },
        { product_id: 'b', visitor_id: null },
      ], error: null },
    ])
    const result = await fetchRecentProductViews(client as never, ['a', 'b', 'c'], now)
    expect([...result.counts]).toEqual([['a', 2], ['b', 1], ['c', 0]])
    expect(result.ignoredAnonymousEvents).toBe(1)
    expect(query.gte).toHaveBeenCalledWith('created_at', '2026-09-03T12:00:00.000Z')
    expect(query.lt).toHaveBeenCalledWith('created_at', '2026-09-10T12:00:00.000Z')
    expect(query.eq).toHaveBeenCalledWith('event_type', 'product_view')
    expect(query.range).toHaveBeenCalledWith(1000, 1999)
    expect(JSON.stringify(result)).not.toContain('visitor-one')
  })

  it('chunks product filters and includes zero counts for listings without events', async () => {
    const { client, query } = analyticsMock([{ data: [], error: null }, { data: [], error: null }])
    const ids = Array.from({ length: 101 }, (_, i) => String(i))
    const result = await fetchRecentProductViews(client as never, ids, now)
    expect(query.in.mock.calls.map(call => call[1].length)).toEqual([100, 1])
    expect(result.counts.size).toBe(101)
    expect([...result.counts.values()].every(n => n === 0)).toBe(true)
  })

  it('fails closed instead of pretending a denied analytics query has no views', async () => {
    const { client } = analyticsMock([{ data: null, error: { message: 'denied' } }])
    await expect(fetchRecentProductViews(client as never, ['a'], now)).rejects.toThrow('ranking cancelado')
  })
})
