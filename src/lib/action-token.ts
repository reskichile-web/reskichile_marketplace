import { createClient } from '@supabase/supabase-js'

export interface ActionTokenView {
  state: 'valid' | 'not_found' | 'used' | 'expired'
  product?: {
    id: string
    brand: string
    model: string | null
    price: number
    slug: string | null
    status: string
    image_url: string | null
  }
}

/** Read-only token + product lookup for the emailed action pages (service role). */
export async function loadActionToken(token: string, action: string): Promise<ActionTokenView> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: row } = await admin
    .from('product_action_tokens')
    .select('token, product_id, action, used_at, expires_at')
    .eq('token', token)
    .eq('action', action)
    .maybeSingle()

  if (!row) return { state: 'not_found' }
  if (row.used_at) return { state: 'used' }
  if (new Date(row.expires_at).getTime() < Date.now()) return { state: 'expired' }

  const { data: product } = await admin
    .from('products')
    .select('id, brand, model, price, slug, status, product_images(url, "order")')
    .eq('id', row.product_id)
    .single()

  const images = (product?.product_images as { url: string; order: number }[] | null) ?? []
  const image_url = images.slice().sort((a, b) => a.order - b.order)[0]?.url ?? null

  return {
    state: 'valid',
    product: product
      ? {
          id: product.id,
          brand: product.brand,
          model: product.model,
          price: product.price,
          slug: product.slug,
          status: product.status,
          image_url,
        }
      : undefined,
  }
}
