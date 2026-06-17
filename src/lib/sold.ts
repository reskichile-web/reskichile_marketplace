// Core "mark as sold" logic shared by the in-app button and the email
// "Sí, lo vendí" confirmation. Takes a service-role Supabase client.
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/send'
import { buildSaleEmail, buildInternalNotice } from '@/lib/email/templates'
import { SOLD_CHANNEL_LABELS, SOLD_SPEED_LABELS } from '@/lib/constants'
import { revalidateProduct } from '@/lib/revalidate'

const SUPPORT_EMAIL = 'reskichile@gmail.com'
const TOKEN_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateToken(length = 24): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  let out = ''
  for (let i = 0; i < length; i++) out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length]
  return out
}

interface SoldInput {
  salePrice?: number | null
  soldChannel?: string | null
  soldSpeed?: string | null
}

interface SoldResult {
  ok: boolean
  error?: string
}

/**
 * Marks a product sold, records sale metadata, mints a single-use undo token,
 * and emails the seller (BCC the ReSkiChile inbox) with an undo button.
 * The caller must have already authorized the action (session owner or a valid
 * confirm_sold token).
 */
export async function markProductSold(
  admin: SupabaseClient,
  productId: string,
  input: SoldInput,
): Promise<SoldResult> {
  // Load the product + seller. anon listings (no users row) have anon_contact.
  const { data: product } = await admin
    .from('products')
    .select('id, brand, model, price, slug, status, seller_id, anon_contact, product_images(url, "order"), users:seller_id(name, email)')
    .eq('id', productId)
    .single()

  if (!product) return { ok: false, error: 'Producto no encontrado' }
  if (product.status === 'sold') return { ok: true } // idempotent

  const salePrice =
    input.salePrice != null && Number.isFinite(input.salePrice) && input.salePrice > 0
      ? Math.round(input.salePrice)
      : null
  const soldChannel = input.soldChannel && SOLD_CHANNEL_LABELS[input.soldChannel] ? input.soldChannel : null
  const soldSpeed = input.soldSpeed && SOLD_SPEED_LABELS[input.soldSpeed] ? input.soldSpeed : null

  const { error: updErr } = await admin
    .from('products')
    .update({
      status: 'sold',
      sale_price: salePrice,
      sold_channel: soldChannel,
      sold_speed: soldSpeed,
      sold_at: new Date().toISOString(),
    })
    .eq('id', productId)

  if (updErr) return { ok: false, error: updErr.message }

  // Sold → no longer in the public catalog; refresh its cached page + home.
  revalidateProduct({ id: product.id, slug: product.slug })

  // Mint a single-use undo token (45-day default expiry from the table).
  const token = generateToken()
  await admin.from('product_action_tokens').insert({
    token,
    product_id: productId,
    action: 'undo_sale',
  })

  // Resolve seller recipient (account email, else an anon_contact email).
  const sellerRaw = product.users as { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null
  const seller = Array.isArray(sellerRaw) ? sellerRaw[0] ?? null : sellerRaw
  const anonEmail = product.anon_contact && product.anon_contact.includes('@') ? product.anon_contact.trim() : null
  const recipient = seller?.email || anonEmail

  const images = (product.product_images as { url: string; order: number }[] | null) ?? []
  const imageUrl = images.slice().sort((a, b) => a.order - b.order)[0]?.url ?? null

  const { subject, html, text } = buildSaleEmail({
    name: seller?.name ?? null,
    brand: product.brand,
    model: product.model,
    listedPrice: product.price,
    salePrice,
    channelLabel: soldChannel ? SOLD_CHANNEL_LABELS[soldChannel] : null,
    speedLabel: soldSpeed ? SOLD_SPEED_LABELS[soldSpeed] : null,
    imageUrl,
    productPath: `/producto/${product.slug || product.id}`,
    undoPath: `/p/venta/deshacer/${token}`,
  })

  if (recipient) {
    // Seller gets the confirmation + undo; team gets a blind copy.
    await sendEmail({ to: recipient, subject, html, text, bcc: SUPPORT_EMAIL })
  } else {
    // No seller inbox (anon with phone-only contact) — still notify the team.
    const notice = buildInternalNotice('Venta registrada (sin correo de vendedor)', [
      { label: 'Producto', value: [product.brand, product.model].filter(Boolean).join(' ') },
      { label: 'Precio venta', value: salePrice != null ? `$${salePrice.toLocaleString('es-CL')}` : '—' },
      { label: 'Contacto', value: product.anon_contact || '—' },
    ])
    await sendEmail({ to: SUPPORT_EMAIL, subject: notice.subject, html: notice.html, text: notice.text })
  }

  return { ok: true }
}

/** Reverts a sale: back to approved, clears sale metadata. */
export async function undoProductSale(admin: SupabaseClient, productId: string): Promise<SoldResult> {
  const { data: updated, error } = await admin
    .from('products')
    .update({
      status: 'approved',
      sale_price: null,
      sold_channel: null,
      sold_speed: null,
      sold_at: null,
    })
    .eq('id', productId)
    .select('id, slug')
    .single()
  if (error) return { ok: false, error: error.message }
  // Back in the catalog — refresh its cached page + home.
  revalidateProduct({ id: productId, slug: (updated?.slug as string | null) ?? null })
  return { ok: true }
}
