import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import {
  approvedReminderActionTokens,
  approvedReminderDeliveryKey,
  isApprovedReminderCampaignDay,
  isApprovedReminderCandidate,
} from '@/lib/sale-reminder-campaign'
import {
  sendSaleReminderForProduct,
  type SaleReminderProduct,
} from '@/lib/sale-reminder-email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH_SIZE = 5
const BATCH_DELAY_MS = 600

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

  if (!isApprovedReminderCampaignDay(new Date())) {
    return NextResponse.json({
      ok: true,
      active: false,
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

  const { data: products, error: productError } = await admin
    .from('products')
    .select('id, brand, model, price, anon_contact, sale_reminder_sent_at, product_images(url, "order"), users:seller_id(email, notify_reminders_email)')
    .eq('status', 'approved')
    .order('id')
    .limit(1000)

  if (productError) {
    return NextResponse.json({ error: 'No pudimos consultar las publicaciones' }, { status: 500 })
  }

  const candidates = ((products || []) as unknown as SaleReminderProduct[])
    .filter(product => isApprovedReminderCandidate(product.sale_reminder_sent_at))
  let sent = 0
  let skipped = 0
  let trackingPending = 0
  const skippedByCode: Record<string, number> = {}

  for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
    const batch = candidates.slice(offset, offset + BATCH_SIZE)
    const results = await Promise.all(batch.map(async product => {
      try {
        return await sendSaleReminderForProduct(admin, product, {
          idempotencyKey: approvedReminderDeliveryKey(product.id),
          actionTokens: approvedReminderActionTokens(secret, product.id),
          ignoreReminderPreference: true,
        })
      } catch {
        return {
          ok: false as const,
          code: 'UNEXPECTED_ERROR' as const,
          error: 'Error inesperado al enviar el recordatorio',
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

  return NextResponse.json({
    ok: true,
    active: true,
    candidates: candidates.length,
    sent,
    skipped,
    skippedByCode,
    trackingPending,
  })
}
