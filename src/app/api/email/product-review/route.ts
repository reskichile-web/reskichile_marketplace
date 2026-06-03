import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { buildReviewEmail } from '@/lib/email/templates'
import { NextResponse } from 'next/server'

// Sends the "tu producto entró en revisión" email to the seller.
// Called (fire-and-forget) by the publish flow right after a registered user
// creates a product. Email failure must never break publishing — the caller
// ignores the result, and we always return 200 for "handled".
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { productId } = await request.json().catch(() => ({}))
  if (!productId) {
    return NextResponse.json({ error: 'Falta productId' }, { status: 400 })
  }

  // The authenticated user must own the product (RLS already scopes this, but
  // be explicit). Only notify for products actually in review.
  const { data: product } = await supabase
    .from('products')
    .select('id, brand, model, slug, status, seller_id')
    .eq('id', productId)
    .eq('seller_id', user.id)
    .single()

  if (!product || product.status !== 'pending') {
    // Nothing to notify about — not an error worth surfacing to the client.
    return NextResponse.json({ ok: true, skipped: true })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .single()

  const { subject, html, text } = buildReviewEmail(profile?.name ?? null, product.brand, product.model)
  // Blind copy to the ReSkiChile inbox so the team sees every new submission.
  // BCC is invisible to the seller. Only on the review email, per request.
  const result = await sendEmail({ to: user.email!, subject, html, text, bcc: 'reskichile@gmail.com' })

  if (!result.ok) {
    console.error('[product-review] email failed:', result.error)
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 })
  }
  return NextResponse.json({ ok: true, id: result.id })
}
