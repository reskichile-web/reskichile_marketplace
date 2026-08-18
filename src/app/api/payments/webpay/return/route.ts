import { NextResponse } from 'next/server'
import { getPaymentCallbackConfig } from '@/lib/env/server'
import { parseWebpayReturn, webpayReturnValues } from '@/lib/payments/return-parser'
import { processWebpayReturn } from '@/lib/payments/payment-service'
import { safeWebpayError } from '@/lib/payments/webpay-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handleReturn(request: Request): Promise<NextResponse> {
  const config = getPaymentCallbackConfig()
  const destination = new URL('/checkout/resultado', config.appUrl)

  try {
    const values = await webpayReturnValues(request)
    const returned = parseWebpayReturn(values)
    const result = await processWebpayReturn(config, returned)
    if (result.publicId) destination.searchParams.set('orden', result.publicId)
  } catch (error) {
    console.error('webpay_return_failed', { reason: safeWebpayError(error) })
  }

  return NextResponse.redirect(destination, {
    status: 303,
    headers: { 'Cache-Control': 'no-store, private' },
  })
}

export async function GET(request: Request) {
  return handleReturn(request)
}

export async function POST(request: Request) {
  return handleReturn(request)
}
