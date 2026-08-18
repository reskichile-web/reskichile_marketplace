import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/send'
import { buildSaleReminderEmail } from '@/lib/email/templates'
import { generateToken } from '@/lib/sold'
import { saleReminderCutoff } from '@/lib/sale-reminder'

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
    const sellerRaw = p.users as { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null
    const seller = Array.isArray(sellerRaw) ? sellerRaw[0] ?? null : sellerRaw
    const anonEmail = p.anon_contact && p.anon_contact.includes('@') ? p.anon_contact.trim() : null
    const recipient = seller?.email || anonEmail
    if (!recipient) { skipped++; continue }

    // Mint the two one-click tokens for this reminder.
    const confirmToken = generateToken()
    const availableToken = generateToken()
    await admin.from('product_action_tokens').insert([
      { token: confirmToken, product_id: p.id, action: 'confirm_sold' },
      { token: availableToken, product_id: p.id, action: 'still_available' },
    ])

    const images = (p.product_images as { url: string; order: number }[] | null) ?? []
    const imageUrl = images.slice().sort((a, b) => a.order - b.order)[0]?.url ?? null

    const { subject, html, text } = buildSaleReminderEmail({
      brand: p.brand,
      model: p.model,
      price: p.price,
      imageUrl,
      // Each link carries the sibling token (?alt=) so its page can offer the
      // opposite choice ("¿te equivocaste?") without re-minting tokens.
      soldPath: `/p/vendi/${confirmToken}?alt=${availableToken}`,
      availablePath: `/p/disponible/${availableToken}?alt=${confirmToken}`,
    })

    const res = await sendEmail({ to: recipient, subject, html, text })
    if (res.ok) {
      await admin.from('products').update({ sale_reminder_sent_at: new Date().toISOString() }).eq('id', p.id)
      sent++
    } else {
      skipped++
    }
  }

  return NextResponse.json({ ok: true, candidates: products?.length ?? 0, sent, skipped })
}
