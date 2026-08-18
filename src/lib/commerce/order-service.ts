import 'server-only'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { verifyPaymentAccessCookie } from './checkout-service'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface GuestOrderResult {
  publicId: string
  orderNumber: string
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

export async function getGuestOrder(
  publicId: string,
  accessCookie: string | undefined
): Promise<GuestOrderResult | null> {
  if (!UUID_RE.test(publicId)) return null

  const supabase = createServiceRoleClient()
  const { data: order, error } = await supabase
    .from('orders')
    .select(
      'id, public_id, order_number, order_status, payment_status, fulfillment_status, subtotal_clp, discount_clp, shipping_clp, total_clp, guest_access_hash, created_at, paid_at'
    )
    .eq('public_id', publicId)
    .maybeSingle()

  if (error || !order) return null
  if (
    !verifyPaymentAccessCookie(
      accessCookie,
      String(order.public_id),
      String(order.guest_access_hash)
    )
  ) {
    return null
  }

  const { data: itemRows, error: itemError } = await supabase
    .from('order_items')
    .select('product_name, line_total_clp, rack_inventory_id')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true })

  if (itemError) return null

  return {
    publicId: String(order.public_id),
    orderNumber: String(order.order_number),
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
