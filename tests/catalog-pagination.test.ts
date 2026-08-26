import { describe, expect, it } from 'vitest'
import {
  filterCatalogMetadata,
  hasCatalogAttributeFilters,
  pageCatalogMetadata,
  parseCatalogFilters,
  type CatalogMetadata,
} from '@/lib/catalog'

const products: CatalogMetadata[] = [
  {
    id: 'ski-new',
    product_type: 'esquis',
    condition: 'como_nuevo',
    region: 'Metropolitana',
    brand: 'Atomic',
    price: 500000,
    attributes: { tipo: ['touring'], genero: ['unisex'], ancho_mm: 95 },
    created_at: '2026-08-26T12:00:00.000Z',
  },
  {
    id: 'ski-old',
    product_type: 'esquis',
    condition: 'usado',
    region: 'Biobío',
    brand: 'Rossignol',
    price: 300000,
    attributes: { tipo: ['pista'], genero: ['hombre'], ancho_mm: 80 },
    created_at: '2026-08-20T12:00:00.000Z',
  },
  {
    id: 'board',
    product_type: 'snowboards',
    condition: 'usado',
    region: 'Metropolitana',
    brand: 'Burton',
    price: 400000,
    attributes: {},
    created_at: '2026-08-25T12:00:00.000Z',
  },
]

describe('catalog incremental pagination', () => {
  it('keeps navbar categories on the fast database-filtered path', () => {
    const filters = parseCatalogFilters(new URLSearchParams('product_type=esquis'))

    expect(hasCatalogAttributeFilters(filters)).toBe(false)
    expect(filterCatalogMetadata(products, filters).map(product => product.id)).toEqual([
      'ski-new',
      'ski-old',
    ])
  })

  it('detects and applies ski attribute filters before slicing a page', () => {
    const filters = parseCatalogFilters(new URLSearchParams(
      'product_type=esquis&tipo=touring&genero=unisex',
    ))

    expect(hasCatalogAttributeFilters(filters)).toBe(true)
    expect(pageCatalogMetadata(products, filters, 0)).toEqual([products[0]])
  })

  it('sorts first, then returns the requested incremental slice', () => {
    const filters = parseCatalogFilters(new URLSearchParams('sort=price_asc'))

    expect(pageCatalogMetadata(products, filters, 1, 1).map(product => product.id)).toEqual([
      'board',
    ])
  })

  it('normalizes invalid prices, sorts and oversized filter lists', () => {
    const filters = parseCatalogFilters(new URLSearchParams(
      `min_price=-1&max_price=nope&sort=name&brand=${Array.from({ length: 25 }, (_, index) => `b${index}`).join(',')}`,
    ))

    expect(filters.minPrice).toBeUndefined()
    expect(filters.maxPrice).toBeUndefined()
    expect(filters.sort).toBe('recent')
    expect(filters.brands).toHaveLength(20)
  })
})
