import { NextResponse } from 'next/server'
import {
  adminErrorResponse,
  assertSameOrigin,
  consumeAdminRateLimit,
  readSmallJson,
  requireElevatedAdmin,
} from '@/lib/admin-security'
import { getRefundConfig } from '@/lib/env/server'
import { requestWebpayRefund } from '@/lib/payments/refund-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const config = getRefundConfig()
    if (!config.enabled) {
      return NextResponse.json(
        { error: 'Los reembolsos están deshabilitados', code: 'REFUNDS_DISABLED' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const admin = await requireElevatedAdmin(config)
    await consumeAdminRateLimit(
      admin.id,
      'refund',
      config.rateLimitSecret,
      5,
      300
    )
    const body = await readSmallJson(request)
    const orderPublicId = typeof body.orderPublicId === 'string' ? body.orderPublicId : ''
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    const amountClp = Number(body.amountClp)

    if (
      !UUID_RE.test(orderPublicId) ||
      !UUID_RE.test(idempotencyKey) ||
      !Number.isSafeInteger(amountClp) ||
      amountClp <= 0 ||
      reason.length < 5 ||
      reason.length > 500 ||
      body.confirmation !== 'REEMBOLSAR'
    ) {
      return NextResponse.json(
        { error: 'Solicitud de reembolso inválida', code: 'INVALID_REFUND' },
        { status: 422, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const result = await requestWebpayRefund({
      orderPublicId,
      adminUserId: admin.id,
      amountClp,
      reason,
      idempotencyKey,
    })
    return NextResponse.json(result, {
      status: result.state === 'uncertain' ? 202 : 200,
      headers: { 'Cache-Control': 'no-store, private' },
    })
  } catch (error) {
    const known = adminErrorResponse(error)
    const message = error instanceof Error && error.message.includes('exceeds refundable')
      ? 'El monto supera el saldo reembolsable.'
      : error instanceof Error && error.message.includes('another refund')
        ? 'Hay otro reembolso que requiere resolución.'
        : known.message
    return NextResponse.json(
      { error: message, code: known.code },
      { status: known.status, headers: { 'Cache-Control': 'no-store, private' } }
    )
  }
}
