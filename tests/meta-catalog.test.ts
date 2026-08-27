import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildMetaCatalogFeed: vi.fn(),
  createPublicServerClient: vi.fn(() => ({ role: 'anonymous' })),
}))

vi.mock('@/lib/meta-catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/meta-catalog')>()
  return { ...actual, buildMetaCatalogFeed: mocks.buildMetaCatalogFeed }
})

vi.mock('@/lib/supabase/server', () => ({
  createPublicServerClient: mocks.createPublicServerClient,
}))

import {
  META_CATALOG_COLUMNS,
  fetchMetaCatalogProducts,
  serializeMetaCatalogCsv,
  toMetaCatalogRow,
  type MetaCatalogRow,
  type MetaCatalogSourceProduct,
} from '@/lib/meta-catalog'
import { GET } from '@/app/api/meta/catalog/route'

const product: MetaCatalogSourceProduct = {
  id: 'ae430621-0019-4a42-bd83-562dfbf3dd2a',
  slug: 'k2-reckoner-102-2026-ae430621',
  product_type: 'esquis',
  brand: 'K2',
  model: 'Reckoner 102 2026',
  description: 'Esquís twin tip con fijaciones.',
  condition: 'usado_como_nuevo',
  price: 650000,
  region: 'Metropolitana',
  product_images: [
    { url: 'https://storage.example/second.jpg', order: 2 },
    { url: 'https://storage.example/first.jpg', order: 0 },
  ],
}

describe('Meta catalog feed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the Pixel content ID and maps a public listing to Meta fields', () => {
    expect(toMetaCatalogRow(product)).toEqual({
      id: product.id,
      title: 'K2 Reckoner 102 2026',
      description: 'Esquís twin tip con fijaciones.',
      availability: 'in stock',
      condition: 'used',
      price: '650000 CLP',
      link: 'https://www.reskichile.cl/producto/k2-reckoner-102-2026-ae430621',
      image_link: 'https://storage.example/first.jpg',
      brand: 'K2',
      product_type: 'Esquís',
      custom_label_0: 'esquis',
      custom_label_1: 'usado_como_nuevo',
      custom_label_2: 'Metropolitana',
    })
  })

  it('creates truthful fallbacks when model or description is missing', () => {
    const row = toMetaCatalogRow({
      ...product,
      product_type: 'pantalones',
      brand: 'Helly Hansen',
      model: null,
      description: null,
      condition: 'nuevo_sellado',
    })

    expect(row).toMatchObject({
      title: 'Helly Hansen Pantalones',
      description: 'Helly Hansen Pantalones. Pantalones. Condición: Nuevo (sellado).',
      condition: 'new',
    })
  })

  it('excludes malformed products instead of emitting unusable catalog items', () => {
    expect(toMetaCatalogRow({ ...product, product_images: [] })).toBeNull()
    expect(toMetaCatalogRow({ ...product, price: 0 })).toBeNull()
    expect(toMetaCatalogRow({ ...product, condition: 'desconocido' })).toBeNull()
    expect(toMetaCatalogRow({ ...product, id: 'not-the-pixel-id' })).toBeNull()
  })

  it('queries only approved public products and keeps the query paginated', async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      range: vi.fn(),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.order.mockReturnValue(query)
    query.limit.mockReturnValue(query)
    query.range.mockResolvedValue({ data: [product], error: null })
    const supabase = { from: vi.fn(() => query) }

    const products = await fetchMetaCatalogProducts(supabase as never)

    expect(products).toEqual([product])
    expect(supabase.from).toHaveBeenCalledWith('products')
    expect(query.eq).toHaveBeenCalledWith('status', 'approved')
    expect(query.range).toHaveBeenCalledWith(0, 499)
  })

  it('serializes quotes, commas and line breaks as valid UTF-8 CSV', () => {
    const row = {
      ...toMetaCatalogRow(product)!,
      title: 'K2 "Reckoner", 102',
      description: 'Primera línea\nSegunda línea',
    } satisfies MetaCatalogRow
    const csv = serializeMetaCatalogCsv([row])

    expect(csv.startsWith(`${META_CATALOG_COLUMNS.join(',')}\r\n`)).toBe(true)
    expect(csv).toContain('"K2 ""Reckoner"", 102"')
    expect(csv).toContain('"Primera línea\nSegunda línea"')
    expect(csv).not.toMatch(/seller|email|phone|telefono/i)
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('serves a non-cached CSV from the anonymous public client', async () => {
    const csv = serializeMetaCatalogCsv([toMetaCatalogRow(product)!])
    mocks.buildMetaCatalogFeed.mockResolvedValue({
      csv,
      sourceCount: 1,
      includedCount: 1,
      excludedProductIds: [],
    })

    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0')
    expect(response.headers.get('x-reski-catalog-items')).toBe('1')
    expect(await response.text()).toBe(csv)
    expect(mocks.createPublicServerClient).toHaveBeenCalledOnce()
    expect(mocks.buildMetaCatalogFeed).toHaveBeenCalledWith({ role: 'anonymous' })
  })

  it('returns a retryable error rather than a destructive empty feed', async () => {
    mocks.buildMetaCatalogFeed.mockRejectedValue(new Error('database unavailable'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await GET()

    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('300')
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(await response.text()).toContain('temporarily unavailable')
    expect(errorSpy).toHaveBeenCalledWith('meta_catalog_feed_failed')
    errorSpy.mockRestore()
  })
})
