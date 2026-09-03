import { describe, expect, it } from 'vitest'
import {
  aggregateRackVariants,
  changedRackInventoryItems,
  totalRackAvailability,
  variantAvailability,
  type RackInventoryProduct,
} from '@/lib/rack-inventory'

const product: RackInventoryProduct = {
  slug: 'madera',
  name: 'Ski Rack Madera',
  material: 'Madera natural',
  priceClp: 17990,
  active: true,
  variants: [
    ['las-condes-s', 'S', 'las_condes'],
    ['las-condes-m', 'M', 'las_condes'],
    ['las-condes-l', 'L', 'las_condes'],
    ['los-angeles-s', 'S', 'los_angeles'],
    ['los-angeles-m', 'M', 'los_angeles'],
    ['los-angeles-l', 'L', 'los_angeles'],
  ].map(([inventoryId, size, originCode]) => ({
    inventoryId,
    size: size as 'S' | 'M' | 'L',
    originCode: originCode as 'las_condes' | 'los_angeles',
    stockOnHand: 3,
    reservedQuantity: 0,
    availableQuantity: 3,
  })),
}

describe('changedRackInventoryItems', () => {
  it('sends only the size changed to zero', () => {
    const draft = Object.fromEntries(
      product.variants.map(variant => [variant.inventoryId, '3']),
    )
    draft['las-condes-m'] = '0'

    expect(changedRackInventoryItems(product, draft)).toEqual([
      { inventoryId: 'las-condes-m', stockOnHand: 0 },
    ])
  })

  it('does not send unchanged variants', () => {
    const draft = Object.fromEntries(
      product.variants.map(variant => [variant.inventoryId, '3']),
    )

    expect(changedRackInventoryItems(product, draft)).toEqual([])
  })

  it('keeps the product available when only one size is sold out', () => {
    const inventory = {
      ...product,
      variants: aggregateRackVariants(product.variants.map(variant => ({
        ...variant,
        stockOnHand: variant.size === 'M' ? 0 : variant.stockOnHand,
        availableQuantity: variant.size === 'M' ? 0 : variant.availableQuantity,
      }))),
    }

    expect(variantAvailability(inventory, 'M')).toBe(0)
    expect(totalRackAvailability(inventory)).toBeGreaterThan(0)
  })
})
