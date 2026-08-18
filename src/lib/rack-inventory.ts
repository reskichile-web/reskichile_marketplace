import { SKI_RACK_SIZES, type SkiRackSize } from '@/lib/ski-rack-products'

export interface RackInventoryVariant {
  inventoryId: string
  size: SkiRackSize
  originCode: 'los_angeles' | 'las_condes' | null
  stockOnHand: number
  reservedQuantity: number
  availableQuantity: number
}

export interface RackInventoryProduct {
  slug: string
  name: string
  material: string
  priceClp: number
  active: boolean
  variants: RackInventoryVariant[]
}

export interface RackInventoryResponse {
  products: RackInventoryProduct[]
}

export interface RackInventoryUpdate {
  inventoryId: string
  stockOnHand: number
}

export type RackInventoryBySlug = Record<string, RackInventoryProduct>

export function inventoryBySlug(products: RackInventoryProduct[]): RackInventoryBySlug {
  return Object.fromEntries(products.map(product => [product.slug, product]))
}

export function variantAvailability(
  product: RackInventoryProduct | undefined,
  size: SkiRackSize,
): number {
  return product?.variants.find(variant => variant.size === size)?.availableQuantity ?? 0
}

export function totalRackAvailability(product: RackInventoryProduct | undefined): number {
  return product?.variants.reduce((total, variant) => total + variant.availableQuantity, 0) ?? 0
}

/** Only persist fields the admin actually changed. */
export function changedRackInventoryItems(
  product: RackInventoryProduct,
  draft: Record<string, string>,
): RackInventoryUpdate[] {
  return product.variants
    .filter(variant => {
      if (!variant.inventoryId) return false
      const value = draft[variant.inventoryId]
      return value !== undefined && value !== '' && Number(value) !== variant.stockOnHand
    })
    .map(variant => ({
      inventoryId: variant.inventoryId,
      stockOnHand: Number(draft[variant.inventoryId]),
    }))
}

export function completeRackVariants(
  variants: RackInventoryVariant[],
): RackInventoryVariant[] {
  return SKI_RACK_SIZES.map(size => variants.find(variant => variant.size === size) || {
    inventoryId: '',
    size,
    originCode: null,
    stockOnHand: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
  })
}

/** Public catalogue exposes what one warehouse can fulfill in a single order. */
export function aggregateRackVariants(
  variants: RackInventoryVariant[],
): RackInventoryVariant[] {
  return SKI_RACK_SIZES.map(size => {
    const rows = variants.filter(variant => variant.size === size)
    return {
      inventoryId: '',
      size,
      originCode: null,
      stockOnHand: rows.reduce((sum, row) => sum + row.stockOnHand, 0),
      reservedQuantity: rows.reduce((sum, row) => sum + row.reservedQuantity, 0),
      // Checkout intentionally ships the complete cart from one origin. The
      // public limit must therefore be the largest single-origin capacity,
      // not the sum of warehouses.
      availableQuantity: Math.max(0, ...rows.map(row => row.availableQuantity)),
    }
  })
}

/** Admin stock keeps one editable row per size and physical origin. */
export function completeRackVariantsByOrigin(
  variants: RackInventoryVariant[],
): RackInventoryVariant[] {
  const origins = ['los_angeles', 'las_condes'] as const
  return origins.flatMap(originCode => SKI_RACK_SIZES.map(size => (
    variants.find(variant => (
      variant.size === size && variant.originCode === originCode
    )) || {
      inventoryId: '',
      size,
      originCode,
      stockOnHand: 0,
      reservedQuantity: 0,
      availableQuantity: 0,
    }
  )))
}
