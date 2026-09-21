import { NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-security'
import { deriveOrderEmailAccessToken } from '@/lib/commerce/checkout-service'
import { getPaymentCallbackConfig } from '@/lib/env/server'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { error: 'Pedido inválido', code: 'INVALID_ORDER' },
        { status: 422, headers: { 'Cache-Control': 'no-store, private' } }
      )
    }

    const config = getPaymentCallbackConfig()
    const accessToken = deriveOrderEmailAccessToken(config, id)
    const destination = new URL('/checkout/resultado', request.url)
    destination.searchParams.set('orden', id)
    destination.searchParams.set('acceso', accessToken)

    return NextResponse.redirect(destination, {
      headers: { 'Cache-Control': 'no-store, private' },
    })
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json(
      { error: known.message, code: known.code },
      { status: known.status, headers: { 'Cache-Control': 'no-store, private' } }
    )
  }
}
