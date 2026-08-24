import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AutomatedProductPost, { type AutomatedPostProduct } from '@/components/ig/AutomatedProductPost'
import { createPublicServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Publicación automatizada · ReskiChile',
  robots: { index: false, follow: false },
}

export default async function AutomatedPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createPublicServerClient()
  const { data: product } = await supabase
    .from('products')
    .select('id, slug, product_type, brand, model, price, condition, region, comuna, attributes, product_images(url, order)')
    .eq('status', 'approved')
    .eq('slug', slug)
    .single()

  if (!product) notFound()

  return <AutomatedProductPost product={product as AutomatedPostProduct} />
}
