import { describe, expect, it } from 'vitest'
import {
  parseCatalogFilters,
  resolveCatalogMetadata,
  type CatalogMetadata,
} from '@/lib/catalog'

const products: CatalogMetadata[] = [
  {
    id: 'salomon-ski',
    product_type: 'esquis',
    condition: 'usado_buen_estado',
    region: 'Metropolitana',
    comuna: 'Las Condes',
    brand: 'Salomon',
    model: 'QST 98',
    description: 'Esquí freeride con fijaciones Marker',
    price: 420000,
    attributes: { tipo: ['freeride'], largo_cm: 176, ancho_mm: 98 },
    created_at: '2026-09-01T12:00:00.000Z',
    catalog_bumped_at: '2026-09-01T12:00:00.000Z',
  },
  {
    id: 'burton-board',
    product_type: 'snowboards',
    condition: 'usado_como_nuevo',
    region: 'Valparaíso',
    brand: 'Burton',
    model: 'Custom Camber',
    description: 'Tabla all mountain',
    price: 350000,
    attributes: { largo: 158, camber: 'Camber clasico' },
    created_at: '2026-09-02T12:00:00.000Z',
    catalog_bumped_at: '2026-09-02T12:00:00.000Z',
  },
  {
    id: 'atomic-boots',
    product_type: 'botas_esqui',
    condition: 'nuevo',
    region: 'Biobío',
    brand: 'Atomic',
    model: 'Hawx Prime',
    description: 'Botas para pista',
    price: 280000,
    attributes: { talla_mondo: '27/27.5', flex: 110 },
    created_at: '2026-09-03T12:00:00.000Z',
    catalog_bumped_at: '2026-09-03T12:00:00.000Z',
  },
]

function search(query: string) {
  return resolveCatalogMetadata(products, parseCatalogFilters(new URLSearchParams({ q: query })))
}

describe('catalog search', () => {
  it('finds brands, models, categories and structured attributes', () => {
    expect(search('Salomon').products[0].id).toBe('salomon-ski')
    expect(search('QST 98').products[0].id).toBe('salomon-ski')
    expect(search('tabla camber').products[0].id).toBe('burton-board')
    expect(search('mondo 27.5 flex 110').products[0].id).toBe('atomic-boots')
  })

  it('is accent-insensitive and understands category synonyms', () => {
    expect(search('esquies freeride').products[0].id).toBe('salomon-ski')
    expect(search('snow tabla').products[0].id).toBe('burton-board')
  })

  it('tolerates misspelled brands and models', () => {
    const result = search('salomn qst')

    expect(result.products[0].id).toBe('salomon-ski')
    expect(result.searchMode).toBe('approximate')
  })

  it('keeps a useful match even when the query contains noise', () => {
    expect(search('quiero salomon puras tonteras').products[0].id).toBe('salomon-ski')
  })

  it('falls back to the recent catalog for complete nonsense', () => {
    const result = search('putas tonteras xyzzy')

    expect(result.searchMode).toBe('fallback')
    expect(result.products.map(product => product.id)).toEqual([
      'atomic-boots',
      'burton-board',
      'salomon-ski',
    ])
  })

  it('defaults searches to relevance and sanitizes shareable queries', () => {
    const filters = parseCatalogFilters(new URLSearchParams({ q: '  Salomon   QST  ' }))

    expect(filters.query).toBe('Salomon QST')
    expect(filters.sort).toBe('relevance')
  })
})
