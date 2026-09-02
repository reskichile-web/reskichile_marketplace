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
    let result: { data: unknown; error: { message: string } | null }
    if (nextStatus === 'shipped') {
      const carrier = typeof body.carrier === 'string' ? body.carrier.trim() : ''
      const trackingNumber = typeof body.trackingNumber === 'string'
        ? body.trackingNumber.trim()
        : ''
      const trackingUrl = typeof body.trackingUrl === 'string'
        ? body.trackingUrl.trim()
        : ''
      let validTrackingUrl = true
      if (trackingUrl) {
        try {
          const parsed = new URL(trackingUrl)
          validTrackingUrl = parsed.protocol === 'https:' && !parsed.username && !parsed.password
        } catch {
          validTrackingUrl = false
        }
      }
      if (
        carrier.length < 2 || carrier.length > 80 ||
        trackingNumber.length < 2 || trackingNumber.length > 120 ||
        trackingUrl.length > 500 || !validTrackingUrl
      ) {
        return NextResponse.json(
          { error: 'Completa el transportista y un seguimiento válido.', code: 'INVALID_TRACKING' },
          { status: 422, headers: { 'Cache-Control': 'no-store' } }
        )
      }
      result = await service.rpc('commerce_admin_mark_shipped', {
        p_order_public_id: id,
        p_admin_user_id: admin.id,
        p_carrier: carrier,
        p_tracking_number: trackingNumber,
        p_tracking_url: trackingUrl || null,
        p_correlation_id: randomUUID(),
      })
    } else {
      result = await service.rpc('commerce_admin_update_fulfillment', {
        p_order_public_id: id,
        p_admin_user_id: admin.id,
        p_next_status: nextStatus,
        p_correlation_id: randomUUID(),
      })
    }
    const { data, error } = result
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
