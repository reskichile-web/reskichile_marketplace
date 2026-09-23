import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import {
  APPROVED_REMINDER_ENDED_AT,
  APPROVED_REMINDER_STARTED_AT,
  approvedReminderFollowupActionTokens,
  approvedReminderFollowupDeliveryKey,
  isApprovedReminderFollowupCandidate,
  isApprovedReminderFollowupDay,
} from '@/lib/sale-reminder-campaign'
import {
  sendSaleReminderForProduct,
  type SaleReminderProduct,
} from '@/lib/sale-reminder-email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH_SIZE = 5
const BATCH_DELAY_MS = 600

interface PreviousResponseRow {
  product_id: string
  used_at: string | null
}

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function authorized(request: Request, secret: string | undefined): secret is string {
  return Boolean(
    secret && request.headers.get('authorization') === `Bearer ${secret}`,
  )
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (!isApprovedReminderFollowupDay(new Date())) {
    return NextResponse.json({
      ok: true,
      active: false,
      previousCampaign: 0,
      confirmedAvailable: 0,
      candidates: 0,
      sent: 0,
      skipped: 0,
    })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const [productsResult, campaignTokensResult, availableResponsesResult] = await Promise.all([
    admin
      .from('products')
      .select('id, brand, model, price, anon_contact, sale_reminder_sent_at, product_images(url, "order"), users:seller_id(email, notify_reminders_email)')
      .eq('status', 'approved')
      .order('id')
      .limit(1000),
    admin
      .from('product_action_tokens')
      .select('product_id, used_at')
      .eq('action', 'still_available')
      .gte('created_at', APPROVED_REMINDER_STARTED_AT)
      .lt('created_at', APPROVED_REMINDER_ENDED_AT)
      .limit(2000),
    admin
      .from('product_action_tokens')
      .select('product_id, used_at')
      .eq('action', 'still_available')
      .gte('used_at', APPROVED_REMINDER_STARTED_AT)
      .limit(2000),
  ])

  if (productsResult.error || campaignTokensResult.error || availableResponsesResult.error) {
    return NextResponse.json(
      { error: 'No pudimos consultar la campaña anterior' },
      { status: 500 },
    )
  }

  const responseByProduct = new Map<string, { seen: boolean; confirmedAvailable: boolean }>()
  for (const row of (campaignTokensResult.data || []) as PreviousResponseRow[]) {
    const current = responseByProduct.get(row.product_id) || {
      seen: false,
      confirmedAvailable: false,
    }
    current.seen = true
    current.confirmedAvailable ||= Boolean(row.used_at)
    responseByProduct.set(row.product_id, current)
  }
  for (const row of (availableResponsesResult.data || []) as PreviousResponseRow[]) {
    const current = responseByProduct.get(row.product_id)
    if (current) current.confirmedAvailable = true
  }

  const products = (productsResult.data || []) as unknown as SaleReminderProduct[]
  const candidates = products.filter(product => {
    const response = responseByProduct.get(product.id)
    return isApprovedReminderFollowupCandidate({
      hasPreviousCampaignToken: Boolean(response?.seen),
      confirmedAvailable: Boolean(response?.confirmedAvailable),
      saleReminderSentAt: product.sale_reminder_sent_at,
    })
  })
  let sent = 0
  let skipped = 0
  let trackingPending = 0
  const skippedByCode: Record<string, number> = {}

  for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
    const batch = candidates.slice(offset, offset + BATCH_SIZE)
    const results = await Promise.all(batch.map(async product => {
      try {
        return await sendSaleReminderForProduct(admin, product, {
          idempotencyKey: approvedReminderFollowupDeliveryKey(product.id),
          actionTokens: approvedReminderFollowupActionTokens(secret, product.id),
          ignoreReminderPreference: true,
        })
      } catch {
        return {
          ok: false as const,
          code: 'UNEXPECTED_ERROR' as const,
          error: 'Error inesperado al enviar el seguimiento',
        }
      }
    }))

    for (const result of results) {
      if (result.ok) {
        sent++
        if (!result.trackingUpdated) trackingPending++
      } else {
        skipped++
        skippedByCode[result.code] = (skippedByCode[result.code] || 0) + 1
      }
    }

    if (offset + BATCH_SIZE < candidates.length) {
      await wait(BATCH_DELAY_MS)
    }
  }

  const previousCampaign = Array.from(responseByProduct.values()).filter(row => row.seen).length
  const confirmedAvailable = Array.from(responseByProduct.values())
    .filter(row => row.confirmedAvailable).length

  return NextResponse.json({
    ok: true,
    active: true,
    previousCampaign,
    confirmedAvailable,
    candidates: candidates.length,
    sent,
    skipped,
    skippedByCode,
    trackingPending,
  })
}
