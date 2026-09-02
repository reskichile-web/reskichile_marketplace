import 'server-only'

import { createServiceRoleClient } from '@/lib/supabase/server'
import type { PaymentConfig } from '@/lib/env/server'
import {
  verifyOrderEmailAccessToken,
  verifyPaymentAccessCookie,
} from './checkout-service'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface GuestOrderResult {
  publicId: string
  orderNumber: string
  buyer: {
    name: string
    email: string
    phone: string
  }
  delivery: {
    method: 'home' | 'pickup'
    region: string
    commune: string
    street: string | null
    number: string | null
    extra: string | null
    formattedAddress: string | null
    pickupPointId: string | null
  }
  orderStatus: string
  paymentStatus: string
  fulfillmentStatus: string
  subtotalClp: number
  discountClp: number
  shippingClp: number
  totalClp: number
  createdAt: string
  paidAt: string | null
  containsRackItems: boolean
  items: Array<{
    name: string
    priceClp: number
  }>
}

function snapshotString(
  snapshot: Record<string, unknown>,
  key: string
): string | null {
  const value = snapshot[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function getGuestOrder(
  publicId: string,
  accessCookie: string | undefined,
  emailAccessToken?: string,
  config?: PaymentConfig
): Promise<GuestOrderResult | null> {
  if (!UUID_RE.test(publicId)) return null

  const supabase = createServiceRoleClient()
  const { data: order, error } = await supabase
    .from('orders')
    .select(
      'id, public_id, order_number, buyer_email, buyer_name, buyer_phone, delivery_method, shipping_snapshot, order_status, payment_status, fulfillment_status, subtotal_clp, discount_clp, shipping_clp, total_clp, guest_access_hash, created_at, paid_at'
    )
    .eq('public_id', publicId)
    .maybeSingle()

  if (error || !order) return null
  const hasCookieAccess = verifyPaymentAccessCookie(
      accessCookie,
      String(order.public_id),
      String(order.guest_access_hash)
    )
  const hasEmailAccess = config
    ? verifyOrderEmailAccessToken(
        config,
        String(order.public_id),
        emailAccessToken
      )
    : false
  if (!hasCookieAccess && !hasEmailAccess) {
    return null
  }

  const { data: itemRows, error: itemError } = await supabase
    .from('order_items')
    .select('product_name, line_total_clp, rack_inventory_id')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true })

  if (itemError) return null

  const shippingSnapshot = order.shipping_snapshot &&
    typeof order.shipping_snapshot === 'object' &&
    !Array.isArray(order.shipping_snapshot)
    ? order.shipping_snapshot as Record<string, unknown>
    : {}
  const deliveryMethod = order.delivery_method === 'pickup' ? 'pickup' : 'home'

  return {
    publicId: String(order.public_id),
    orderNumber: String(order.order_number),
    buyer: {
      name: String(order.buyer_name),
      email: String(order.buyer_email),
      phone: String(order.buyer_phone),
    },
    delivery: {
      method: deliveryMethod,
      region: snapshotString(shippingSnapshot, 'region') || '',
      commune: snapshotString(shippingSnapshot, 'commune') || '',
      street: snapshotString(shippingSnapshot, 'street'),
      number: snapshotString(shippingSnapshot, 'number'),
      extra: snapshotString(shippingSnapshot, 'extra'),
      formattedAddress: snapshotString(shippingSnapshot, 'formatted_address'),
      pickupPointId: snapshotString(shippingSnapshot, 'pickup_point_id'),
    },
    orderStatus: String(order.order_status),
    paymentStatus: String(order.payment_status),
    fulfillmentStatus: String(order.fulfillment_status),
    subtotalClp: Number(order.subtotal_clp),
    discountClp: Number(order.discount_clp),
    shippingClp: Number(order.shipping_clp),
    totalClp: Number(order.total_clp),
    createdAt: String(order.created_at),
    paidAt: order.paid_at ? String(order.paid_at) : null,
    containsRackItems: (itemRows || []).some(item => Boolean(item.rack_inventory_id)),
    items: (itemRows || []).map((item) => ({
      name: String(item.product_name),
      priceClp: Number(item.line_total_clp),
    })),
  }
}
