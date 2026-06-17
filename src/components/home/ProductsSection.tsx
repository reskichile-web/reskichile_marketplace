import { createPublicServerClient } from '@/lib/supabase/server'
import ProductBrowser from '@/components/ProductBrowser'

export default async function ProductsSection() {
  // Anonymous (no-cookie) client so the home page stays ISR-cacheable.
  const supabase = createPublicServerClient()

  const { data: products } = await supabase
    .from('products')
    .select('id, slug, product_type, brand, model, price, condition, region, product_images(url, order)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  if (!products || products.length === 0) return null

  return <ProductBrowser products={products} />
}
