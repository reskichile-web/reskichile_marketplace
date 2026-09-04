import { createPublicServerClient } from '@/lib/supabase/server'
import ProductBrowser from '@/components/ProductBrowser'
import { getRecentlyPublishedProductIds } from '@/lib/recent-products'

export default async function ProductsSection() {
  // Anonymous (no-cookie) client so the home page stays ISR-cacheable.
  const supabase = createPublicServerClient()

  const { data: products } = await supabase
    .from('products')
    .select('id, slug, product_type, brand, model, price, previous_price, condition, region, created_at, product_images(url, order)')
    .eq('status', 'approved')
    .order('previous_price', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (!products || products.length === 0) return null

  const recentProductIds = [...getRecentlyPublishedProductIds(products)]

  return <ProductBrowser products={products} recentProductIds={recentProductIds} />
}
