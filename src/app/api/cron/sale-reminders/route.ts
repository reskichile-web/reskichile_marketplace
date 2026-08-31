import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { saleReminderCutoff } from '@/lib/sale-reminder'
import {
  sendSaleReminderForProduct,
  type SaleReminderProduct,
} from '@/lib/sale-reminder-email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Daily "¿lo vendiste?" reminder for listings that crossed 30 days_published.
// Triggered by Vercel Cron (vercel.json). Protected: Vercel sends
// `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is set. Re-reminds
// every ~30 days while the product stays live.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const reRemindCutoff = saleReminderCutoff()

  // Approved, 30+ days live, and either never reminded or last reminder >30d ago.
  const { data: products, error } = await admin
    .from('products')
    .select('id, brand, model, price, slug, days_published, sale_reminder_sent_at, anon_contact, product_images(url, "order"), users:seller_id(name, email)')
    .eq('status', 'approved')
    .gte('days_published', 30)
    .or(`sale_reminder_sent_at.is.null,sale_reminder_sent_at.lt.${reRemindCutoff}`)
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0
  let skipped = 0

  for (const p of products ?? []) {
    const result = await sendSaleReminderForProduct(
      admin,
      p as unknown as SaleReminderProduct,
    )
    if (result.ok) {
      sent++
    } else {
      console.error('[sale-reminder-cron] Reminder skipped', {
        productId: p.id,
        code: result.code,
      })
      skipped++
    }
  }

  return NextResponse.json({ ok: true, candidates: products?.length ?? 0, sent, skipped })
}
