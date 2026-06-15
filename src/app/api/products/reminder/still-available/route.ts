import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/send'
import { buildInternalNotice } from '@/lib/email/templates'

const SUPPORT_EMAIL = 'reskichile@gmail.com'

// "No, sigue disponible" from the 30-day reminder. Notifies the team fast and
// resets the reminder clock (cron will re-remind in ~30 more days).
export async function POST(request: Request) {
  const { token } = await request.json().catch(() => ({}))
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: row } = await admin
    .from('product_action_tokens')
    .select('token, product_id, action, used_at, expires_at')
    .eq('token', token)
    .eq('action', 'still_available')
    .maybeSingle()

  if (!row) return NextResponse.json({ error: 'Enlace no válido' }, { status: 404 })
  if (row.used_at) return NextResponse.json({ ok: true, already: true })
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Este enlace expiró' }, { status: 410 })
  }

  const { data: product } = await admin
    .from('products')
    .select('id, brand, model, price, slug, days_published, region, comuna, anon_contact, users:seller_id(name, email, phone)')
    .eq('id', row.product_id)
    .single()

  // Reset the reminder clock so the cron re-reminds in ~30 days, and mark used.
  await admin.from('products').update({ sale_reminder_sent_at: new Date().toISOString() }).eq('id', row.product_id)
  await admin.from('product_action_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)

  // Notify the team fast.
  if (product) {
    const sellerRaw = product.users as { name: string | null; email: string | null; phone: string | null } | { name: string | null; email: string | null; phone: string | null }[] | null
    const seller = Array.isArray(sellerRaw) ? sellerRaw[0] ?? null : sellerRaw
    const title = [product.brand, product.model].filter(Boolean).join(' ') || 'Producto'
    const notice = buildInternalNotice('Sigue disponible — el vendedor lo confirmó', [
      { label: 'Producto', value: title },
      { label: 'Precio', value: `$${product.price.toLocaleString('es-CL')}` },
      { label: 'Días publicado', value: String(product.days_published) },
      { label: 'Ubicación', value: [product.comuna, product.region].filter(Boolean).join(', ') },
      { label: 'Vendedor', value: seller?.name || 'Anónimo' },
      { label: 'Contacto', value: seller?.email || seller?.phone || product.anon_contact || '—' },
      { label: 'Ver', value: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://reskichile.cl'}/producto/${product.slug || product.id}` },
    ])
    await sendEmail({ to: SUPPORT_EMAIL, subject: notice.subject, html: notice.html, text: notice.text })
  }

  return NextResponse.json({ ok: true })
}
