import { createPublicServerClient } from '@/lib/supabase/server'
import ProductBrowser from '@/components/ProductBrowser'
import { getRecentlyPublishedProductIds } from '@/lib/recent-products'

export default async function ProductsSection() {
  // Anonymous (no-cookie) client so the home page stays ISR-cacheable.
  const supabase = createPublicServerClient()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)

  let products: Awaited<ReturnType<typeof loadProducts>> | null
  try {
    products = await loadProducts(supabase, controller.signal)
  } catch {
    // The homepage shell must still build/render if Supabase is degraded.
    // Products can repopulate on the next ISR revalidation.
    products = null
  } finally {
    clearTimeout(timeout)
  }

  if (!products || products.length === 0) return null

  const recentProductIds = [...getRecentlyPublishedProductIds(products)]

  return <ProductBrowser products={products} recentProductIds={recentProductIds} />
}

async function loadProducts(
  supabase: ReturnType<typeof createPublicServerClient>,
  signal: AbortSignal,
) {
  const { data, error } = await supabase
    .from('products')
    .select('id, slug, product_type, brand, model, price, previous_price, condition, region, created_at, catalog_bumped_at, product_images(url, order)')
    .eq('status', 'approved')
    .order('catalog_bumped_at', { ascending: false })
    .abortSignal(signal)

  if (error) throw error
  return data
}
