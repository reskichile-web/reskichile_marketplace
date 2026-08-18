import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { completeRackVariantsByOrigin, type RackInventoryVariant } from '@/lib/rack-inventory'
import type { SkiRackSize } from '@/lib/ski-rack-products'

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

async function adminUserId(): Promise<string | null> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  return profile?.is_admin ? user.id : null
}

async function inventoryResponse() {
  const service = createServiceRoleClient()
  const { data, error } = await service.rpc('commerce_rack_availability')
  if (error) throw error

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

  return {
    products: Array.from(grouped.values()).map(product => ({
      ...product,
      variants: completeRackVariantsByOrigin(product.variants),
    })),
  }
}

export async function GET() {
  if (!await adminUserId()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    return NextResponse.json(await inventoryResponse(), {
      headers: { 'Cache-Control': 'no-store, private' },
    })
  } catch {
    return NextResponse.json({ error: 'No pudimos cargar el inventario' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const userId = await adminUserId()
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as { items?: unknown } | null
  if (!body || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
    return NextResponse.json({ error: 'Inventario inválido' }, { status: 422 })
  }

  const items: Array<{ inventoryId: string; stockOnHand: number }> = []
  for (const raw of body.items) {
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Inventario inválido' }, { status: 422 })
    }
    const item = raw as Record<string, unknown>
    if (
      typeof item.inventoryId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(item.inventoryId) ||
      !Number.isInteger(item.stockOnHand) ||
      Number(item.stockOnHand) < 0 ||
      Number(item.stockOnHand) > 100000
    ) {
      return NextResponse.json({ error: 'Las cantidades deben ser enteros positivos' }, { status: 422 })
    }
    items.push({
      inventoryId: item.inventoryId,
      stockOnHand: Number(item.stockOnHand),
    })
  }

  const service = createServiceRoleClient()
  const { error } = await service.rpc('commerce_admin_set_rack_inventory', {
    p_admin_user_id: userId,
    p_items: items.map(item => ({
      inventory_id: item.inventoryId,
      stock_on_hand: item.stockOnHand,
    })),
  })
  if (error) {
    const message = error.message.includes('below active reservations')
      ? 'No puedes reducir el stock por debajo de las unidades reservadas en pagos activos.'
      : 'No pudimos guardar el inventario.'
    return NextResponse.json({ error: message }, { status: 409 })
  }

  return NextResponse.json(await inventoryResponse(), {
    headers: { 'Cache-Control': 'no-store, private' },
  })
}
