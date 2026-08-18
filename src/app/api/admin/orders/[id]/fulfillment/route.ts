import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import {
  adminErrorResponse,
  assertSameOrigin,
  readSmallJson,
  requireAdmin,
} from '@/lib/admin-security'
import { createServiceRoleClient } from '@/lib/supabase/server'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED = new Set(['preparing', 'ready_for_pickup', 'shipped', 'delivered', 'cancelled'])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin()
    const { id } = await params
    const body = await readSmallJson(request)
    const nextStatus = typeof body.status === 'string' ? body.status : ''
    if (!UUID_RE.test(id) || !ALLOWED.has(nextStatus)) {
      return NextResponse.json(
        { error: 'Transición inválida', code: 'INVALID_FULFILLMENT' },
        { status: 422, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const service = createServiceRoleClient()
    const { data, error } = await service.rpc(
      'commerce_admin_update_fulfillment',
      {
        p_order_public_id: id,
        p_admin_user_id: admin.id,
        p_next_status: nextStatus,
        p_correlation_id: randomUUID(),
      }
    )
    if (error || !data) {
      const message = error?.message.includes('refunded before cancellation')
        ? 'Debes reembolsar el pago antes de cancelar la preparación.'
        : 'La transición ya no es válida. Actualiza la página.'
      return NextResponse.json(
        { error: message, code: 'FULFILLMENT_CONFLICT' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    return NextResponse.json(data, {
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
