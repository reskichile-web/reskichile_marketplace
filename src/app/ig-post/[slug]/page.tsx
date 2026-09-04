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
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
  const { data: product } = await supabase
    .from('products')
    .select('id, slug, product_type, brand, model, price, condition, region, comuna, attributes, product_images(url, order)')
    .eq('status', 'approved')
    .eq(isId ? 'id' : 'slug', slug)
    .single()

  if (!product) notFound()

  return (
    <>
      {/* This route is a render surface, not a marketplace page. Global UI
          must never become part of the exported 1080×1920 artwork. */}
      <style>{`#marketing-consent-overlay { display: none !important; }`}</style>
      <AutomatedProductPost product={product as AutomatedPostProduct} />
    </>
  )
}
