import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPaymentConfig } from '@/lib/env/server'
import {
  assertTrustedCheckoutRequest,
  CheckoutServiceError,
  consumeCheckoutRateLimit,
  createCheckout,
  guestTokenFromPaymentCookie,
  paymentAccessCookie,
  paymentAccessCookieName,
  readCheckoutJson,
} from '@/lib/commerce/checkout-service'
import {
  CheckoutValidationError,
  parseCheckoutInput,
} from '@/lib/commerce/checkout-validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function errorResponse(error: unknown): NextResponse {
  if (error instanceof CheckoutValidationError) {
    return NextResponse.json(
      { error: error.message, code: 'VALIDATION_ERROR' },
      { status: 422, headers: { 'Cache-Control': 'no-store' } }
    )
  }
  if (error instanceof CheckoutServiceError) {
    if (error.status >= 500) {
      console.error('checkout_create_failed', {
        code: error.code,
        reason: error.message,
      })
    }
    return NextResponse.json(
      { error: error.publicMessage, code: error.code },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } }
    )
  }
  console.error('checkout_create_failed', { reason: 'unexpected_error' })
  return NextResponse.json(
    { error: 'No pudimos iniciar el pago. No se realizó ningún cobro.', code: 'INTERNAL_ERROR' },
    { status: 500, headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: NextRequest) {
  try {
    const config = getPaymentConfig()
    assertTrustedCheckoutRequest(config, request)
    await consumeCheckoutRateLimit(config, request, 'create')
    const input = parseCheckoutInput(await readCheckoutJson(request))
    const cookieName = paymentAccessCookieName(config)
    const currentCookie = request.cookies.get(cookieName)?.value
    const guestAccessToken =
      guestTokenFromPaymentCookie(currentCookie) ||
      randomBytes(32).toString('base64url')
    const checkout = await createCheckout(config, input, guestAccessToken)

    const response = NextResponse.json(
      {
        publicId: checkout.publicId,
        orderNumber: checkout.orderNumber,
        totalClp: checkout.totalClp,
        url: checkout.url,
        token: checkout.token,
        reused: checkout.reused,
      },
      { headers: { 'Cache-Control': 'no-store, private' } }
    )
    response.cookies.set({
      name: cookieName,
      value: paymentAccessCookie(checkout.publicId, guestAccessToken),
      httpOnly: true,
      secure: config.appUrl.protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 2,
    })
    return response
  } catch (error) {
    return errorResponse(error)
  }
}
