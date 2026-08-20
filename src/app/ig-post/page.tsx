import { connection } from 'next/server'
import { notFound, redirect } from 'next/navigation'
import { createPublicServerClient } from '@/lib/supabase/server'

export default async function RandomAutomatedPostPage() {
  await connection()

  const supabase = createPublicServerClient()
  const { data: products } = await supabase
    .from('products')
    .select('slug, product_images(url)')
    .eq('status', 'approved')
    .not('slug', 'is', null)
    .limit(500)

  const eligible = (products || []).filter(product => (
    product.slug && product.product_images?.some(image => /\.png(?:\?|$)/i.test(image.url))
  ))

  if (eligible.length === 0) notFound()

  const product = eligible[Math.floor(Math.random() * eligible.length)]
  redirect(`/ig-post/${product.slug}`)
}
