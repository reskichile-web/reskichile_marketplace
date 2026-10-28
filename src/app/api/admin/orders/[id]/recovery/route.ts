import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { adminErrorResponse, assertSameOrigin, readSmallJson, requireAdmin } from '@/lib/admin-security'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { reviewOrderPayment } from '@/lib/payments/payment-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const headers = { 'Cache-Control': 'no-store, private' }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin()
    const { id } = await params
    const body = await readSmallJson(request)
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Pedido inválido' }, { status: 422, headers })
    if (body.action === 'review_payment') {
      const result = await reviewOrderPayment(id, admin.id)
      return NextResponse.json({ reviewed: Boolean(result), state: result?.state }, { headers })
    }
    const service = createServiceRoleClient()
    let result
    if (body.action === 'manual_delivery') {
      const note = typeof body.note === 'string' ? body.note.trim() : ''
      if (note.length < 5 || note.length > 500) {
        return NextResponse.json({ error: 'Indica cómo se coordinará la entrega (5 a 500 caracteres).' }, { status: 422, headers })
      }
      // Resolve the provider first. The SQL transition refuses live/uncertain
      // attempts and never changes their original amounts or authorization.
      await reviewOrderPayment(id, admin.id)
      result = await service.rpc('commerce_admin_set_manual_delivery', {
        p_order_public_id: id, p_admin_user_id: admin.id, p_note: note, p_correlation_id: randomUUID(),
      })
    } else if (body.action === 'manual_payment') {
      const reference = typeof body.reference === 'string' ? body.reference.trim() : ''
      if (!['cash', 'bank_transfer'].includes(String(body.method)) ||
        !Number.isSafeInteger(body.amountClp) || Number(body.amountClp) <= 0 || reference.length < 3 || reference.length > 200) {
        return NextResponse.json({ error: 'Completa el medio, monto y respaldo del pago recibido.' }, { status: 422, headers })
      }
      result = await service.rpc('commerce_admin_record_manual_payment', {
        p_order_public_id: id, p_admin_user_id: admin.id, p_method: body.method,
        p_amount_clp: body.amountClp, p_reference: reference, p_correlation_id: randomUUID(), p_notify_buyer: true,
      })
    } else {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 422, headers })
    }
    if (result.error || !result.data) {
      const error = result.error?.message.includes('insufficient rack stock')
        ? 'El stock ya no está disponible. Revisa el inventario antes de continuar.'
        : 'No se puede cambiar este pedido: verifica el pago, la reserva y el monto. Un cobro Webpay aprobado debe resolverse antes de quitar el despacho.'
      return NextResponse.json({ error }, { status: 409, headers })
    }
    return NextResponse.json(result.data, { headers })
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json({ error: known.message, code: known.code }, { status: known.status, headers })
  }
}
