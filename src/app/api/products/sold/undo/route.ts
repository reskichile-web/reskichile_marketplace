import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { undoProductSale } from '@/lib/sold'

// Undo a sale from the emailed link. Token-authorized (no session needed) —
// the action only runs on a POST from the confirmation page's button, so an
// email link scanner that GETs the page can't trigger it.
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
    .eq('action', 'undo_sale')
    .maybeSingle()

  if (!row) return NextResponse.json({ error: 'Enlace no válido' }, { status: 404 })
  if (row.used_at) return NextResponse.json({ error: 'Este enlace ya fue usado' }, { status: 410 })
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Este enlace expiró' }, { status: 410 })
  }

  const result = await undoProductSale(admin, row.product_id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })

  await admin.from('product_action_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)
  return NextResponse.json({ ok: true })
}
