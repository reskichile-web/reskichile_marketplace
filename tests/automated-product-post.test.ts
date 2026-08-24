import { describe, expect, it } from 'vitest'
import {
  productFacts,
  type AutomatedPostProduct,
} from '@/components/ig/AutomatedProductPost'

function product(overrides: Partial<AutomatedPostProduct> = {}): AutomatedPostProduct {
  return {
    id: 'product-1',
    slug: 'producto-prueba',
    product_type: 'bolsos',
    brand: 'Rossignol',
    model: 'Bolso para snowboard',
    price: 50_000,
    condition: 'usado_buen_estado',
    region: 'Metropolitana',
    comuna: 'Las Condes',
    attributes: {},
    product_images: [],
    ...overrides,
  }
}

describe('automated product post facts', () => {
  it('shows only intrinsic product attributes without location or condition fallbacks', () => {
    expect(productFacts(product({ attributes: { tiene_ruedas: false } }))).toEqual([
      { label: 'RUEDAS', value: 'SIN RUEDAS' },
    ])
  })

  it('leaves the facts empty when the product has no intrinsic attributes', () => {
    expect(productFacts(product())).toEqual([])
  })
})
