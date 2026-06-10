import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { PRODUCT_TYPES } from '@/lib/constants'
import type { ProductWithImages } from '@/lib/types'
import ProductDetailClient from '@/components/ProductDetailClient'
import TrackProductView from '@/components/TrackProductView'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const supabase = createServerSupabaseClient()
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)
    const query = supabase.from('products').select('brand, model, price, product_type, product_images(url, order)')
    const { data: product } = isUuid
      ? await query.eq('id', params.id).single()
      : await query.eq('slug', params.id).single()

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
  const supabase = createServerSupabaseClient()
  const { user, isAdmin } = await getAuthUser()

  // Support both UUID and slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)
  const query = supabase.from('products').select('*, product_images(*)')
  const { data } = isUuid
    ? await query.eq('id', params.id).single()
    : await query.eq('slug', params.id).single()

  if (!data) notFound()

  const product = data as unknown as ProductWithImages

  // Whether the seller has opted to hide their WhatsApp number on this listing.
  // Pulled via SECURITY DEFINER RPC because RLS on users blocks reading the
  // flag directly from the client. Defaults to false on any error.
  let sellerHidePhone = false
  if (product.seller_id) {
    const { data: hideRes } = await supabase.rpc('is_seller_phone_hidden', {
      p_seller: product.seller_id,
    })
    sellerHidePhone = hideRes === true
  }

  // Private view counter: owner and admin see it; their own visits never
  // count (the tracker only renders for third-party viewers).
  const isOwner = user != null && user.id === product.seller_id
  let viewCount: number | null = null
  if (isOwner || isAdmin) {
    const { data: counts } = await supabase.rpc('product_view_counts', {
      p_ids: [product.id],
    })
    viewCount = counts?.[0]?.views ?? 0
  }

  return (
    <>
      {!isOwner && !isAdmin && (
        <TrackProductView productId={product.id} category={product.product_type} />
      )}
      <ProductDetailClient
        product={product}
        userId={user?.id ?? null}
        isAdmin={isAdmin}
        sellerHidePhone={sellerHidePhone}
        viewCount={viewCount}
      />
    </>
  )
}
