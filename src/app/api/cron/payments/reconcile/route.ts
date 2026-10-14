import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { getPaymentReconciliationConfig } from '@/lib/env/server'
import { reconcilePendingWebpayPayments } from '@/lib/payments/payment-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(request: Request, secret: string): boolean {
  if (secret.length < 32) return false
  const actual = request.headers.get('authorization') || ''
  const expected = `Bearer ${secret}`
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  )
}

export async function POST(request: Request) {
  try {
    const config = getPaymentReconciliationConfig()
    if (!authorized(request, config.reconciliationJobSecret)) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // Keep the worst-case provider time below the 60-second Hobby function
    // limit. An interrupted batch is safe: each attempt has a recoverable lease.
    const batchSize = Math.max(
      1,
      Math.min(5, Math.floor(45000 / config.transbankTimeoutMs))
    )
    const summary = await reconcilePendingWebpayPayments(config, batchSize)
    return NextResponse.json(
      { ok: true, ...summary },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      { error: 'No se pudo ejecutar la conciliación' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
