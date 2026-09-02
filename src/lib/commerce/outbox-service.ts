import 'server-only'

import { randomUUID } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { getPaymentCallbackConfig } from '@/lib/env/server'
import { deriveOrderEmailAccessToken } from '@/lib/commerce/checkout-service'
import {
  buildInternalNotice,
  buildOrderConfirmationEmail,
  buildPickupReadyEmail,
  buildRefundConfirmationEmail,
  buildShipmentEmail,
  type BuiltEmail,
  type CommerceEmailItem,
} from '@/lib/email/templates'

interface OutboxRow {
  outbox_id: string
  outbox_kind:
    | 'order_confirmation'
    | 'fulfillment_notice'
    | 'shipment_notice'
    | 'pickup_ready_notice'
    | 'refund_confirmation'
    | 'payment_alert'
    | 'refund_alert'
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

interface DeliveryDetails {
  shippingCarrier: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  pickupLabel: string | null
  pickupAddress: string | null
  pickupInstructions: string | null
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

function buildOutboxEmail(
  row: OutboxRow,
  orderAccessToken: string,
  details: DeliveryDetails | null,
): { to: string; email: BuiltEmail } {
  const teamEmail = process.env.COMMERCE_ALERT_EMAIL || 'reskichile@gmail.com'
  if (row.outbox_kind === 'order_confirmation') {
    return {
      to: row.buyer_email,
      email: buildOrderConfirmationEmail({
        buyerName: row.buyer_name,
        orderNumber: row.order_number,
        orderPublicId: row.order_public_id,
        accessToken: orderAccessToken,
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

  if (row.outbox_kind === 'shipment_notice') {
    if (!details?.shippingCarrier || !details.trackingNumber) {
      throw new Error('shipment details are incomplete')
    }
    return {
      to: row.buyer_email,
      email: buildShipmentEmail({
        buyerName: row.buyer_name,
        orderNumber: row.order_number,
        carrier: details.shippingCarrier,
        trackingNumber: details.trackingNumber,
        trackingUrl: details.trackingUrl,
      }),
    }
  }

  if (row.outbox_kind === 'pickup_ready_notice') {
    return {
      to: row.buyer_email,
      email: buildPickupReadyEmail({
        buyerName: row.buyer_name,
        orderNumber: row.order_number,
        pickupLabel: details?.pickupLabel || 'Punto de retiro ReSkiChile',
        pickupAddress: details?.pickupAddress || [row.destination_commune, row.destination_region].filter(Boolean).join(', '),
        pickupInstructions: details?.pickupInstructions || 'Te contactaremos para coordinar la dirección y el momento exactos del retiro.',
      }),
    }
  }

  if (row.outbox_kind === 'refund_confirmation') {
    return {
      to: row.buyer_email,
      email: buildRefundConfirmationEmail({
        buyerName: row.buyer_name,
        orderNumber: row.order_number,
        amountClp: Number(row.refund_amount_clp || 0),
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
    const itemSummary = emailItems(row.items)
      .map(item => `${item.quantity}× ${item.name}`)
      .join(' · ')
    return {
      to: teamEmail,
      email: buildInternalNotice(`Nueva compra pagada · ${row.order_number} · ${money(Number(row.total_clp))}`, [
        ...commonRows,
        { label: 'Comprador', value: `${row.buyer_name} · ${row.buyer_email}` },
        { label: 'Productos', value: itemSummary || 'Sin detalle' },
        { label: 'Entrega', value: row.delivery_method === 'pickup' ? 'Punto de retiro' : 'Domicilio' },
        { label: 'Destino', value: [row.destination_commune, row.destination_region].filter(Boolean).join(', ') },
      ]),
    }
  }
  if (row.outbox_kind === 'refund_alert') {
    return {
      to: teamEmail,
      email: buildInternalNotice(`ACCIÓN NECESARIA · Reembolso por revisar · ${row.order_number}`, [
        ...commonRows,
        { label: 'Monto solicitado', value: money(Number(row.refund_amount_clp || 0)) },
        { label: 'Estado', value: row.refund_state || 'uncertain' },
        { label: 'Motivo', value: row.refund_reason || 'Sin detalle' },
      ]),
    }
  }
  return {
    to: teamEmail,
    email: buildInternalNotice(`ACCIÓN NECESARIA · Pago por revisar · ${row.order_number}`, [
      ...commonRows,
      { label: 'Estado', value: row.payment_state || 'reconciliation_required' },
      { label: 'Código', value: row.payment_error_code || 'Sin detalle' },
    ]),
  }
}

async function loadDeliveryDetails(
  service: ReturnType<typeof createServiceRoleClient>,
  row: OutboxRow,
): Promise<DeliveryDetails | null> {
  if (!['shipment_notice', 'pickup_ready_notice'].includes(row.outbox_kind)) {
    return null
  }

  const { data: order, error } = await service
    .from('orders')
    .select('shipping_carrier, tracking_number, tracking_url, shipping_snapshot')
    .eq('public_id', row.order_public_id)
    .maybeSingle()
  if (error || !order) throw new Error('delivery details query failed')

  const snapshot = order.shipping_snapshot && typeof order.shipping_snapshot === 'object' && !Array.isArray(order.shipping_snapshot)
    ? order.shipping_snapshot as Record<string, unknown>
    : {}
  const pickupPointId = typeof snapshot.pickup_point_id === 'string'
    ? snapshot.pickup_point_id
    : ''
  let pickup: Record<string, unknown> | null = null
  if (row.outbox_kind === 'pickup_ready_notice' && pickupPointId) {
    const { data, error: pickupError } = await service
      .from('shipping_origins')
      .select('pickup_label, pickup_address, pickup_instructions')
      .eq('code', pickupPointId)
      .eq('pickup_enabled', true)
      .maybeSingle()
    if (pickupError) throw new Error('pickup details query failed')
    pickup = data as Record<string, unknown> | null
  }

  const value = (source: Record<string, unknown> | null, key: string): string | null => {
    const raw = source?.[key]
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null
  }
  return {
    shippingCarrier: typeof order.shipping_carrier === 'string' ? order.shipping_carrier : null,
    trackingNumber: typeof order.tracking_number === 'string' ? order.tracking_number : null,
    trackingUrl: typeof order.tracking_url === 'string' ? order.tracking_url : null,
    pickupLabel: value(pickup, 'pickup_label'),
    pickupAddress: value(pickup, 'pickup_address'),
    pickupInstructions: value(pickup, 'pickup_instructions'),
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
  const paymentConfig = getPaymentCallbackConfig()
  const { data, error } = await service.rpc('commerce_claim_outbox', {
    p_limit: Math.max(1, Math.min(limit, 20)),
    p_correlation_id: correlationId,
    p_environment: paymentConfig.environment,
  })
  if (error) throw new Error('outbox claim failed')
  const rows = (data || []) as unknown as OutboxRow[]
  summary.claimed = rows.length

  for (const row of rows) {
    try {
      const details = await loadDeliveryDetails(service, row)
      const orderAccessToken = deriveOrderEmailAccessToken(
        paymentConfig,
        row.order_public_id,
      )
      const { to, email } = buildOutboxEmail(row, orderAccessToken, details)
      const result = await sendEmail({
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo: process.env.COMMERCE_ALERT_EMAIL || 'reskichile@gmail.com',
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
