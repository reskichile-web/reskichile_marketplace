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
  if (!product?.active) return 0
  const available = product.variants.find(variant => variant.size === size)?.availableQuantity
  return Number.isSafeInteger(available) && Number(available) > 0 ? Number(available) : 0
}

export function totalRackAvailability(product: RackInventoryProduct | undefined): number {
  if (!product?.active) return 0
  return product.variants.reduce((total, variant) => (
    total + (Number.isSafeInteger(variant.availableQuantity) && variant.availableQuantity > 0 ? variant.availableQuantity : 0)
  ), 0)
}

/** A failed or malformed response must never be interpreted as zero stock. */
export async function fetchRackInventory(): Promise<RackInventoryBySlug> {
  const response = await fetch('/api/racks/inventory', {
    cache: 'no-store', credentials: 'same-origin',
  })
  if (!response.ok) throw new Error('inventory request failed')
  const data = await response.json() as RackInventoryResponse
  if (!data || !Array.isArray(data.products) || data.products.some(product => (
    !product || typeof product.slug !== 'string' || typeof product.active !== 'boolean'
    || !Array.isArray(product.variants) || product.variants.some(variant => (
      !variant || !SKI_RACK_SIZES.includes(variant.size)
      || !Number.isSafeInteger(variant.availableQuantity) || variant.availableQuantity < 0
    ))
  ))) throw new Error('invalid inventory response')
  return inventoryBySlug(data.products)
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
