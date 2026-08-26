import { NextResponse } from 'next/server'
import {
  AdminRequestError,
  adminErrorResponse,
  assertSameOrigin,
  readSmallJson,
  requireAdmin,
} from '@/lib/admin-security'
import { cleanupQueuedProductStories } from '@/lib/instagram/story-cleanup'
import { revalidateProduct } from '@/lib/revalidate'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    await requireAdmin()
    const { id } = await params
    if (!UUID_RE.test(id)) {
      throw new AdminRequestError('Producto inválido', 422, 'INVALID_PRODUCT_ID')
    }

    const body = await readSmallJson(request)
    const hasSalePrice = Object.prototype.hasOwnProperty.call(body, 'sale_price')
    const salePrice = body.sale_price
    if (
      hasSalePrice
      && salePrice !== null
      && (typeof salePrice !== 'number' || !Number.isFinite(salePrice) || salePrice <= 0)
    ) {
      throw new AdminRequestError('Precio de venta inválido', 422, 'INVALID_SALE_PRICE')
    }

    const service = createServiceRoleClient()
    const { data: product, error: productError } = await service
      .from('products')
      .select('id, slug, status')
      .eq('id', id)
      .maybeSingle()
    if (productError || !product) {
      throw new AdminRequestError('Producto no encontrado', 404, 'PRODUCT_NOT_FOUND')
    }

    const patch: Record<string, unknown> = {
      status: 'sold',
      sold_at: new Date().toISOString(),
    }
    if (hasSalePrice) {
      patch.sale_price = salePrice === null ? null : Math.round(salePrice as number)
    }
    const { error: updateError } = await service.from('products').update(patch).eq('id', id)
    if (updateError) throw new Error('No pudimos marcar el producto como vendido')

    let cleanup = { queued: 0, removed: 0, failed: 0 }
    try {
      cleanup = await cleanupQueuedProductStories({ service, productIds: [id] })
    } catch {
      // The trigger already released the schedule and removed DB history. Keep
      // the queued JPEG deletion retryable instead of reverting the sold UI.
      cleanup.failed = 1
      console.error('[admin-product-sold] Instagram Story storage cleanup deferred', {
        productId: id,
      })
    }
    revalidateProduct({ id, slug: product.slug })

    return NextResponse.json(
      { ok: true, cleanup },
      { headers: { 'Cache-Control': 'no-store, private' } },
    )
  } catch (error) {
    const known = adminErrorResponse(error)
    const message = known.status === 500 && error instanceof Error ? error.message : known.message
    return NextResponse.json(
      { error: message, code: known.code },
      { status: known.status, headers: { 'Cache-Control': 'no-store, private' } },
    )
  }
}
