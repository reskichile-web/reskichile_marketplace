import { createServerSupabaseClient } from '@/lib/supabase/server'
import ProductBrowser from '@/components/ProductBrowser'

export default async function ProductsSection() {
  const supabase = createServerSupabaseClient()

  const { data: products } = await supabase
    .from('products')
    .select('id, product_type, brand, model, price, condition, region, product_images(url, order)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  if (!products || products.length === 0) return null

  return <ProductBrowser products={products} />
}
