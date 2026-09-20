import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import {
  SALE_REMINDER_INTERVAL_DAYS,
  saleReminderCutoff,
} from '@/lib/sale-reminder'
import { saleReminderActionTokens } from '@/lib/sale-reminder-campaign'
import {
  sendSaleReminderForProduct,
  type SaleReminderProduct,
} from '@/lib/sale-reminder-email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH_SIZE = 5

interface RegularSaleReminderProduct extends SaleReminderProduct {
  sale_reminder_sent_at: string | null
}

// Daily "¿lo vendiste?" reminder for listings that crossed 15 days_published.
// Triggered by Vercel Cron (vercel.json), authenticated with CRON_SECRET, and
// repeated every ~15 days while the product stays live.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const reRemindCutoff = saleReminderCutoff()

  // Approved, 15+ days live, and either never reminded or last reminder >15d ago.
  const { data: products, error } = await admin
    .from('products')
    .select('id, brand, model, price, slug, days_published, sale_reminder_sent_at, anon_contact, product_images(url, "order"), users:seller_id(name, email, notify_reminders_email)')
    .eq('status', 'approved')
    .gte('days_published', SALE_REMINDER_INTERVAL_DAYS)
    .or(`sale_reminder_sent_at.is.null,sale_reminder_sent_at.lt.${reRemindCutoff}`)
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0
  let skipped = 0
  let trackingPending = 0
  const skippedByCode: Record<string, number> = {}
  const candidates = (products || []) as unknown as RegularSaleReminderProduct[]

  for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
    const batch = candidates.slice(offset, offset + BATCH_SIZE)
    const results = await Promise.all(batch.map(async product => {
      const deliveryKey = [
        `sale-reminder-${SALE_REMINDER_INTERVAL_DAYS}-day`,
        product.id,
        product.sale_reminder_sent_at || 'initial',
      ].join('/')
      try {
        return await sendSaleReminderForProduct(admin, product, {
          idempotencyKey: deliveryKey,
          actionTokens: saleReminderActionTokens(secret, deliveryKey),
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
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    sent,
    skipped,
    skippedByCode,
    trackingPending,
  })
}
