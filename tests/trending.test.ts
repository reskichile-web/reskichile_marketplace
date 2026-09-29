import { describe, expect, it, vi } from 'vitest'
import { fetchTrendingProductIds } from '@/lib/trending'
import { parseCatalogFilters, pageCatalogMetadata, type CatalogMetadata } from '@/lib/catalog'

describe('Trending membership', () => {
  it('reads the persisted order with a hard limit of 40', async () => {
    const query = { select: vi.fn(), order: vi.fn(), limit: vi.fn() }
    query.select.mockReturnValue(query)
    query.order.mockReturnValue(query)
    query.limit.mockResolvedValue({ data: [{ product_id: 'b' }, { product_id: 'a' }], error: null })
    const client = { from: vi.fn(() => query) }
    expect(await fetchTrendingProductIds(client as never)).toEqual(['b', 'a'])
    expect(client.from).toHaveBeenCalledWith('trending_products')
    expect(query.order).toHaveBeenCalledWith('position', { ascending: true })
    expect(query.limit).toHaveBeenCalledWith(40)
  })

  it('fails rather than erasing Meta membership when its query is unavailable', async () => {
    const query = { select: vi.fn(), order: vi.fn(), limit: vi.fn() }
    query.select.mockReturnValue(query)
    query.order.mockReturnValue(query)
    query.limit.mockResolvedValue({ data: null, error: { code: '42501' } })
    await expect(fetchTrendingProductIds({ from: () => query } as never)).rejects.toThrow('trending_query_failed')
  })
})

describe('Trending catalog', () => {
  const products: CatalogMetadata[] = Array.from({ length: 45 }, (_, index) => ({
    id: String(index), product_type: 'esquis', brand: 'Test', condition: 'nuevo',
    region: 'Metropolitana', price: 1000 + index, attributes: {},
    created_at: new Date(2026, 8, index + 1).toISOString(),
    trending_position: index < 40 ? index + 1 : undefined,
  }))

  it('keeps product types separate from the dynamic collection', () => {
    const filters = parseCatalogFilters(new URLSearchParams('collection=trending&product_type=esquis'))
    expect(filters.collection).toBe('trending')
    expect(filters.sort).toBe('trending')
    expect(filters.types).toEqual(['esquis'])
  })

  it('paginates only the 40 members in ranking order', () => {
    const filters = parseCatalogFilters(new URLSearchParams('collection=trending'))
    expect(pageCatalogMetadata(products, filters, 0).map(p => p.id)).toEqual(products.slice(0, 24).map(p => p.id))
    expect(pageCatalogMetadata(products, filters, 24).map(p => p.id)).toEqual(products.slice(24, 40).map(p => p.id))
    expect(pageCatalogMetadata(products, filters, 40)).toEqual([])
  })

  it('retains membership when applying price sorting and filters', () => {
    const filters = parseCatalogFilters(new URLSearchParams('collection=trending&sort=price_desc&min_price=1035'))
    expect(pageCatalogMetadata(products, filters, 0).map(p => p.id)).toEqual(['39', '38', '37', '36', '35'])
  })

  it('never expands a failed Trending search into the full marketplace', () => {
    const filters = parseCatalogFilters(new URLSearchParams('collection=trending&q=zzzzzz'))
    expect(pageCatalogMetadata(products, filters, 24)).toHaveLength(16)
  })
})
