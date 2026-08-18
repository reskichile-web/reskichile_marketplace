import 'server-only'

import { randomUUID } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import {
  buildInternalNotice,
  buildOrderConfirmationEmail,
  type BuiltEmail,
  type CommerceEmailItem,
} from '@/lib/email/templates'

interface OutboxRow {
  outbox_id: string
  outbox_kind: 'order_confirmation' | 'fulfillment_notice' | 'payment_alert' | 'refund_alert'
  dedupe_key: string
  order_public_id: string
  order_number: string
  buyer_email: string
  buyer_name: string
  delivery_method: 'home' | 'pickup'
  destination_region: string | null
  destination_commune: string | null
  subtotal_clp: number
  discount_clp: number
  shipping_clp: number
  total_clp: number
  payment_state: string | null
  payment_error_code: string | null
  refund_amount_clp: number | null
  refund_state: string | null
  refund_reason: string | null
  items: unknown
}

export interface OutboxSummary {
  claimed: number
  delivered: number
  retried: number
  uncertain: number
  deadLetter: number
  failed: number
}

function money(value: number): string {
  return '$' + value.toLocaleString('es-CL')
}

function emailItems(value: unknown): CommerceEmailItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(raw => {
    if (!raw || typeof raw !== 'object') return []
    const item = raw as Record<string, unknown>
    const name = typeof item.name === 'string' ? item.name : ''
    const quantity = Number(item.quantity)
    const lineTotalClp = Number(item.line_total_clp)
    if (
      !name ||
      !Number.isSafeInteger(quantity) || quantity < 1 ||
      !Number.isSafeInteger(lineTotalClp) || lineTotalClp < 1
    ) return []
    return [{ name, quantity, lineTotalClp }]
  })
}

function buildOutboxEmail(row: OutboxRow): { to: string; email: BuiltEmail } {
  const teamEmail = process.env.COMMERCE_ALERT_EMAIL || 'reskichile@gmail.com'
  if (row.outbox_kind === 'order_confirmation') {
    return {
      to: row.buyer_email,
      email: buildOrderConfirmationEmail({
        buyerName: row.buyer_name,
        orderNumber: row.order_number,
        orderPublicId: row.order_public_id,
        deliveryMethod: row.delivery_method,
        destinationRegion: row.destination_region || 'Sin región',
        destinationCommune: row.destination_commune || 'Sin comuna',
        subtotalClp: Number(row.subtotal_clp),
        discountClp: Number(row.discount_clp),
        shippingClp: Number(row.shipping_clp),
        totalClp: Number(row.total_clp),
        items: emailItems(row.items),
      }),
    }
  }

  const orderUrl = `${process.env.APP_URL || 'https://www.reskichile.cl'}/admin/pedidos`
  const commonRows = [
    { label: 'Orden', value: row.order_number },
    { label: 'Total', value: money(Number(row.total_clp)) },
    { label: 'Panel', value: orderUrl },
  ]
  if (row.outbox_kind === 'fulfillment_notice') {
    return {
      to: teamEmail,
      email: buildInternalNotice('Nueva orden lista para preparar', [
        ...commonRows,
        { label: 'Entrega', value: row.delivery_method === 'pickup' ? 'Punto de retiro' : 'Domicilio' },
        { label: 'Destino', value: [row.destination_commune, row.destination_region].filter(Boolean).join(', ') },
      ]),
    }
  }
  if (row.outbox_kind === 'refund_alert') {
    return {
      to: teamEmail,
      email: buildInternalNotice('Reembolso requiere conciliación manual', [
        ...commonRows,
        { label: 'Monto solicitado', value: money(Number(row.refund_amount_clp || 0)) },
        { label: 'Estado', value: row.refund_state || 'uncertain' },
        { label: 'Motivo', value: row.refund_reason || 'Sin detalle' },
      ]),
    }
  }
  return {
    to: teamEmail,
    email: buildInternalNotice('Pago requiere conciliación', [
      ...commonRows,
      { label: 'Estado', value: row.payment_state || 'reconciliation_required' },
      { label: 'Código', value: row.payment_error_code || 'Sin detalle' },
    ]),
  }
}

function safeDeliveryError(error: string | undefined, status: number | undefined): string {
  if (status) return `resend_http_${status}`
  if (!error) return 'delivery_failed'
  const normalized = error.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80)
  return normalized || 'delivery_failed'
}

export async function processCommerceOutbox(limit = 10): Promise<OutboxSummary> {
  const summary: OutboxSummary = {
    claimed: 0,
    delivered: 0,
    retried: 0,
    uncertain: 0,
    deadLetter: 0,
    failed: 0,
  }
  const correlationId = randomUUID()
  const service = createServiceRoleClient()
  const { data, error } = await service.rpc('commerce_claim_outbox', {
    p_limit: Math.max(1, Math.min(limit, 20)),
    p_correlation_id: correlationId,
  })
  if (error) throw new Error('outbox claim failed')
  const rows = (data || []) as unknown as OutboxRow[]
  summary.claimed = rows.length

  for (const row of rows) {
    try {
      const { to, email } = buildOutboxEmail(row)
      const result = await sendEmail({
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        idempotencyKey: row.dedupe_key,
      })
      if (result.ok) {
        const { data: completed, error: completeError } = await service.rpc(
          'commerce_complete_outbox',
          {
            p_outbox_id: row.outbox_id,
            p_correlation_id: correlationId,
            p_provider_message_id: result.id || null,
          }
        )
        if (completeError || !completed) throw new Error('outbox completion failed')
        summary.delivered++
        continue
      }

      const { data: failedState, error: failError } = await service.rpc(
        'commerce_fail_outbox',
        {
          p_outbox_id: row.outbox_id,
          p_correlation_id: correlationId,
          p_error_code: safeDeliveryError(result.error, result.status),
          p_retryable: Boolean(result.retryable),
          p_uncertain: Boolean(result.uncertain),
        }
      )
      if (failError) throw new Error('outbox failure persistence failed')
      if (failedState === 'retry') summary.retried++
      else if (failedState === 'uncertain') summary.uncertain++
      else summary.deadLetter++
    } catch {
      // Failure after a provider success is ambiguous. Leave the row processing:
      // the same provider idempotency key may reclaim it inside the safe window.
      summary.failed++
    }
  }

  return summary
}
