import { describe, expect, it, vi } from 'vitest'
import { rotateCatalogProducts, fetchCatalogAppearances } from '../scripts/lib/ig-catalog-rotation.mjs'
import { rankTrendingProducts } from '../scripts/lib/ig-catalog-ranking.mjs'

const now = new Date('2026-09-10T12:00:00Z')
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString()
const item = (id: string, score: number, status = 'approved') => ({ id, status, ranking: { score } })

describe('Catalog rotation', () => {
  it('keeps the formula order with empty confirmed history and never writes appearances', () => {
    const ranked = [item('a', 90), item('b', 50)]
    const history = new Map<string, string>()
    expect(rotateCatalogProducts(ranked, history, now).map(p => p.id)).toEqual(['a', 'b'])
    expect(history.size).toBe(0)
    expect(ranked[0]).not.toHaveProperty('rotation')
  })
  it('puts all eligible products before recent appearances, even a recent high scorer', () => {
    const ranked = [item('shown', 99), item('new', 50), item('rested', 30)]
    const result = rotateCatalogProducts(ranked, new Map([['shown', ago(1)], ['rested', ago(14)]]), now)
    expect(result.map(p => p.id)).toEqual(['new', 'rested', 'shown'])
    expect(result.map(p => p.rotation.reason)).toEqual(['never-published', 'cooldown-complete', 'oldest-recent-fallback'])
  })
  it('completes a short batch oldest appearance first, then score for tied dates', () => {
    const result = rotateCatalogProducts([item('recent-hit', 99), item('older-hit', 80), item('older', 20), item('never', 1)],
      new Map([['recent-hit', ago(1)], ['older-hit', ago(13)], ['older', ago(13)]]), now)
    expect(result.map(p => p.id)).toEqual(['never', 'older-hit', 'older', 'recent-hit'])
  })
  it('treats exactly fourteen days as eligible and a millisecond less as recent', () => {
    const result = rotateCatalogProducts([item('recent', 99), item('eligible', 1)],
      new Map([['recent', new Date(Date.parse(ago(14)) + 1).toISOString()], ['eligible', ago(14)]]), now)
    expect(result[0].id).toBe('eligible')
  })
  it('excludes sold and paused products and never duplicates a small catalog', () => {
    const result = rotateCatalogProducts([item('sold', 99, 'sold'), item('paused', 90, 'draft'), item('a', 50)],
      new Map([['a', ago(1)]]), now).slice(0, 18)
    expect(result.map(p => p.id)).toEqual(['a'])
    expect(rotateCatalogProducts([], new Map(), now)).toEqual([])
  })
  it('rejects duplicate products and invalid/future history', () => {
    expect(() => rotateCatalogProducts([item('a', 1), item('a', 1)], new Map(), now)).toThrow('duplicados')
    for (const value of ['invalid', ago(-1)]) {
      expect(() => rotateCatalogProducts([item('a', 1)], new Map([['a', value]]), now)).toThrow('aparición')
    }
  })
  it('rotates all 107 unchanged products over six batches, even without new products or views', () => {
    const products = Array.from({ length: 107 }, (_, i) => ({
      id: String(i).padStart(3, '0'), status: 'approved', created_at: ago(100),
    }))
    const views = new Map(products.map(p => [p.id, 0]))
    const history = new Map<string, string>()
    const selected = new Set<string>()
    for (const day of [0, 2, 4, 7, 9, 11]) {
      const at = new Date(now.getTime() + day * 86_400_000)
      const ranked = rankTrendingProducts(products, views, at)
      const batch = rotateCatalogProducts(ranked, history, at).slice(0, 18)
      expect(new Set(batch.map(p => p.id)).size).toBe(18)
      if (day < 11) expect(batch.every(p => !selected.has(p.id))).toBe(true)
      for (const p of batch) { selected.add(p.id); history.set(p.id, at.toISOString()) }
    }
    expect(selected.size).toBe(107)
  })
  it('reads confirmed history and fails closed on a missing migration or outage', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: [{ product_id: 'a', last_published_at: ago(3) }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'missing relation' } })
    expect(await fetchCatalogAppearances({ rpc } as never, ['a', 'b'], now)).toEqual(new Map([['a', ago(3)]]))
    expect(rpc).toHaveBeenCalledWith('instagram_catalog_last_appearances', { p_product_ids: ['a', 'b'], p_until: now.toISOString() })
    await expect(fetchCatalogAppearances({ rpc } as never, ['a'], now)).rejects.toThrow('historial vacío')
  })
})
