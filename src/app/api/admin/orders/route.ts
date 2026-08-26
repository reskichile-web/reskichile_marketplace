import { NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-security'
import { getRefundConfig } from '@/lib/env/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { adminPageMeta, parseAdminPageParams } from '@/lib/admin-pagination'

export const dynamic = 'force-dynamic'

interface RefundRow {
  amount_clp: number
  state: string
}

interface AttemptRow {
  id: string
  state: string
  amount_clp: number
  environment: string
  authorized_at: string | null
  last_error_code: string | null
}

export async function GET(request: Request) {
  try {
    await requireAdmin()
    const service = createServiceRoleClient()
    const { offset, limit } = parseAdminPageParams(new URL(request.url).searchParams)
    const { data, count, error } = await service
      .from('orders')
      .select(`
        public_id, order_number, buyer_email, buyer_name, buyer_phone,
        delivery_method, shipping_snapshot, order_status, payment_status,
        fulfillment_status, subtotal_clp, discount_clp, shipping_clp,
        total_clp, paid_at, created_at, updated_at,
        order_items(id, product_name, sku, unit_price_clp, quantity, line_total_clp),
        payment_attempts(id, state, amount_clp, environment, authorized_at, last_error_code),
        refunds(id, amount_clp, state, reason, provider_type, response_code, created_at)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) throw new Error('orders query failed')

    let refundsEnabled = false
    try {
      refundsEnabled = getRefundConfig().enabled
    } catch {
      refundsEnabled = false
    }

    const orders = (data || []).map(order => {
      const attempts = (order.payment_attempts || []) as AttemptRow[]
      const refunds = (order.refunds || []) as RefundRow[]
      const authorizedAttempt = attempts.find(attempt => attempt.state === 'authorized')
      const succeededRefunds = refunds
        .filter(refund => refund.state === 'succeeded')
        .reduce((sum, refund) => sum + Number(refund.amount_clp), 0)
      const hasOpenRefund = refunds.some(refund =>
        ['requested', 'processing', 'uncertain'].includes(refund.state)
      )
      return {
        ...order,
        refundable_clp: Math.max(
          0,
          Number(authorizedAttempt?.amount_clp || 0) - succeededRefunds
        ),
        has_open_refund: hasOpenRefund,
      }
    })

    return NextResponse.json(
      {
        orders,
        refundsEnabled,
        ...adminPageMeta(count || 0, offset, orders.length),
      },
      { headers: { 'Cache-Control': 'no-store, private' } }
    )
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json(
      { error: known.message, code: known.code },
      { status: known.status, headers: { 'Cache-Control': 'no-store, private' } }
    )
  }
}
