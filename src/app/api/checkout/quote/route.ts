import { NextResponse } from 'next/server'
import { getPaymentConfig } from '@/lib/env/server'
import {
  assertTrustedCheckoutRequest,
  CheckoutServiceError,
  consumeCheckoutRateLimit,
  quoteCheckout,
  readCheckoutJson,
} from '@/lib/commerce/checkout-service'
import {
  CheckoutValidationError,
  parseCheckoutInput,
} from '@/lib/commerce/checkout-validation'
import { getAddressConfig } from '@/lib/env/server'
import {
  AddressServiceError,
  verifyCheckoutShippingAddress,
} from '@/lib/commerce/address-service'

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
    return NextResponse.json(
      { error: error.publicMessage, code: error.code },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } }
    )
  }
  if (error instanceof AddressServiceError) {
    return NextResponse.json(
      { error: error.publicMessage, code: error.code },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } }
    )
  }
  console.error('checkout_quote_failed', { reason: 'unexpected_error' })
  return NextResponse.json(
    { error: 'No pudimos calcular el despacho.', code: 'INTERNAL_ERROR' },
    { status: 500, headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: Request) {
  try {
    const config = getPaymentConfig()
    assertTrustedCheckoutRequest(config, request)
    await consumeCheckoutRateLimit(config, request, 'quote')
    const input = verifyCheckoutShippingAddress(
      getAddressConfig(),
      parseCheckoutInput(await readCheckoutJson(request))
    )
    const quote = await quoteCheckout(config, input)
    return NextResponse.json(quote, {
      headers: { 'Cache-Control': 'no-store, private' },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
