import type { Metadata } from 'next'
import { cache } from 'react'
import { createPublicServerClient } from '@/lib/supabase/server'
import { PRODUCT_TYPES } from '@/lib/constants'
import type { ProductWithImages } from '@/lib/types'
import ProductDetailClient from '@/components/ProductDetailClient'
import ProductFallback from '@/components/ProductFallback'
import TrackProductView from '@/components/TrackProductView'

// Approved product pages are generated on demand and cached at the edge. Product
// mutations explicitly invalidate this route, so a longer fallback window keeps
// reads low without leaving edits stale. Do not add generateStaticParams here:
// pre-rendering the full catalogue makes every deployment fan out into Supabase.
export const revalidate = 900

interface Props {
  params: Promise<{ id: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Approved product fetch via the anonymous (no-cookie) client so the render
// stays cacheable. Deduped per request and shared with generateMetadata.
const getApprovedProduct = cache(async (idOrSlug: string) => {
  const supabase = createPublicServerClient()
  const query = supabase.from('products').select('*, product_images(*)').eq('status', 'approved')
  const { data } = UUID_RE.test(idOrSlug)
    ? await query.eq('id', idOrSlug).maybeSingle()
    : await query.eq('slug', idOrSlug).maybeSingle()
  return data as unknown as ProductWithImages | null
})

async function getSellerHidePhone(
  supabase: ReturnType<typeof createPublicServerClient>,
  sellerId: string | null
): Promise<boolean> {
  if (!sellerId) return false
  // SECURITY DEFINER RPC — viewer-independent (the seller's own flag), so it's
  // safe to read with the anonymous client and keep the page cacheable.
  const { data } = await supabase.rpc('is_seller_phone_hidden', { p_seller: sellerId })
  return data === true
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params
    const product = await getApprovedProduct(id)

    if (!product) return { title: 'Producto - ReskiChile' }

    const title = [product.brand, product.model].filter(Boolean).join(' ')
    const mainImage = (product.product_images as { url: string; order: number }[])
      ?.sort((a, b) => a.order - b.order)[0]

    return {
      title: `${title} - ReskiChile`,
      description: `${PRODUCT_TYPES[product.product_type] || product.product_type} - $${product.price.toLocaleString('es-CL')} en ReskiChile`,
      openGraph: {
        title: `${title} - ReskiChile`,
        description: `${PRODUCT_TYPES[product.product_type] || product.product_type} por $${product.price.toLocaleString('es-CL')}`,
        images: mainImage ? [{ url: mainImage.url }] : [],
      },
    }
  } catch {
    return { title: 'Producto - ReskiChile' }
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params
  // Cacheable path: approved product fetched anonymously (no cookies touched),
  // so this render is ISR-cached at the edge.
  const product = await getApprovedProduct(id)

  // Not approved (or missing) → hand off to a client fallback that re-fetches
  // with the viewer's session (RLS). This keeps the route cookie-free, so the
  // common approved case stays cached, while owners can still see their own
  // pending/draft/sold listings.
  if (!product) {
    return <ProductFallback idOrSlug={id} />
  }

  const sellerHidePhone = await getSellerHidePhone(createPublicServerClient(), product.seller_id)

  return (
    <>
      <TrackProductView
        productId={product.id}
        category={product.product_type}
        sellerId={product.seller_id}
        name={[product.brand, product.model].filter(Boolean).join(' ')}
        price={product.price}
      />
      <ProductDetailClient
        product={product}
        sellerHidePhone={sellerHidePhone}
      />
    </>
  )
}
