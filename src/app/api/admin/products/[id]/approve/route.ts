import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { buildApprovedEmail } from '@/lib/email/templates'
import { NextResponse } from 'next/server'

// Admin approves a product. This is the source of truth for the transition,
// so the approval email can only fire on a real admin-driven approval (the
// old client-side update() can't be spoofed into sending mail). The email is
// skipped if the product was already approved, so re-clicking won't re-send.
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Service role: read the seller's email/name (cross-user, hidden by RLS) and
  // write the status regardless of who owns the row.
  const admin = createServiceRoleClient()

  const { data: product } = await admin
    .from('products')
    .select('id, brand, model, slug, price, condition, product_type, status, seller_id, product_images (url, order), users:seller_id (name, email)')
    .eq('id', params.id)
    .single()

  if (!product) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }

  const wasAlreadyApproved = product.status === 'approved'

  const { error: updateError } = await admin
    .from('products')
    .update({ status: 'approved', rejection_reason: null })
    .eq('id', params.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Only email on a genuine pending → approved transition, and only when the
  // seller has an account email (anon listings have no inbox to notify).
  // The embedded join can come back as an object or a single-element array.
  const sellerRaw = product.users as
    | { name: string | null; email: string | null }
    | { name: string | null; email: string | null }[]
    | null
  const seller = Array.isArray(sellerRaw) ? sellerRaw[0] ?? null : sellerRaw
  let emailResult: { ok: boolean; error?: string } = { ok: true }
  if (!wasAlreadyApproved && seller?.email) {
    const images = (product.product_images as { url: string; order: number }[] | null) ?? []
    const imageUrl = images.slice().sort((a, b) => a.order - b.order)[0]?.url ?? null
    const { subject, html, text } = buildApprovedEmail(seller.name, {
      brand: product.brand,
      model: product.model,
      price: product.price,
      condition: product.condition,
      productType: product.product_type,
      imageUrl,
      path: `/producto/${product.slug || product.id}`,
    })
    // BCC the ReSkiChile inbox so the team has a copy of every approval and can
    // confirm the email actually fired (invisible to the seller).
    emailResult = await sendEmail({ to: seller.email, subject, html, text, bcc: 'reskichile@gmail.com' })
    if (!emailResult.ok) {
      console.error('[approve] email failed:', emailResult.error)
    }
  }

  return NextResponse.json({ ok: true, emailed: !wasAlreadyApproved && !!seller?.email && emailResult.ok })
}
