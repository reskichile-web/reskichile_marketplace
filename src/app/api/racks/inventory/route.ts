import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { aggregateRackVariants, type RackInventoryVariant } from '@/lib/rack-inventory'
import type { SkiRackSize } from '@/lib/ski-rack-products'
import { isSkiRackStorefrontEnabled } from '@/lib/ski-rack-visibility'

export const dynamic = 'force-dynamic'

interface AvailabilityRow {
  inventory_id: string
  product_slug: string
  product_name: string
  material: string
  price_clp: number
  active: boolean
  size: SkiRackSize
  shipping_origin_code: 'los_angeles' | 'las_condes'
  stock_on_hand: number
  reserved_quantity: number
  available_quantity: number
}

export async function GET() {
  if (!isSkiRackStorefrontEnabled()) {
    return NextResponse.json(
      { error: 'No encontrado.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('commerce_rack_availability')

  if (error) {
    console.error('rack_inventory_load_failed', { reason: error.code || 'database_error' })
    return NextResponse.json(
      { error: 'No pudimos consultar el inventario.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const grouped = new Map<string, {
    slug: string
    name: string
    material: string
    priceClp: number
    active: boolean
    variants: RackInventoryVariant[]
  }>()

  for (const row of (data || []) as AvailabilityRow[]) {
    const product = grouped.get(row.product_slug) || {
      slug: row.product_slug,
      name: row.product_name,
      material: row.material,
      priceClp: Number(row.price_clp),
      active: row.active,
      variants: [],
    }
    product.variants.push({
      inventoryId: row.inventory_id,
      size: row.size,
      originCode: row.shipping_origin_code,
      stockOnHand: Number(row.stock_on_hand),
      reservedQuantity: Number(row.reserved_quantity),
      availableQuantity: Number(row.available_quantity),
    })
    grouped.set(row.product_slug, product)
  }

  return NextResponse.json(
    {
      products: Array.from(grouped.values()).map(product => ({
        ...product,
        variants: aggregateRackVariants(product.variants),
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
