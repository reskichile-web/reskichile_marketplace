import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { markProductSold } from '@/lib/sold'

// "Sí, lo vendí" from the 30-day reminder email. Token-authorized; runs only on
// the confirmation page's POST. Accepts optional sale price / channel / speed.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const token = body.token
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
    .eq('action', 'confirm_sold')
    .maybeSingle()

  if (!row) return NextResponse.json({ error: 'Enlace no válido' }, { status: 404 })
  if (row.used_at) return NextResponse.json({ error: 'Este enlace ya fue usado' }, { status: 410 })
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Este enlace expiró' }, { status: 410 })
  }

  const result = await markProductSold(admin, row.product_id, {
    salePrice: typeof body.sale_price === 'number' ? body.sale_price : null,
    soldChannel: typeof body.sold_channel === 'string' ? body.sold_channel : null,
    soldSpeed: typeof body.sold_speed === 'string' ? body.sold_speed : null,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })

  await admin.from('product_action_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)
  return NextResponse.json({ ok: true })
}
