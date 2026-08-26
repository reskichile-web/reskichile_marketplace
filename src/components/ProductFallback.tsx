'use client'

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ProductWithImages } from '@/lib/types'
import ProductDetailClient from '@/components/ProductDetailClient'
import TrackProductView from '@/components/TrackProductView'
import Spinner from '@/components/Spinner'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Client fallback for product pages that the anonymous server fetch couldn't see
 * (i.e. NOT 'approved'). The owner/admin may still be allowed to view their own
 * listing, so we re-fetch with the browser client — which carries their session,
 * so RLS returns the row only to people allowed to see it. Keeping this off the
 * server is what lets /producto/[id] stay ISR-cacheable for approved listings.
 */
export default function ProductFallback({ idOrSlug }: { idOrSlug: string }) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'found'; product: ProductWithImages; hidePhone: boolean }
  >({ status: 'loading' })

  useEffect(() => {
    const supabase = createClient()
    let active = true

    ;(async () => {
      const query = supabase.from('products').select('*, product_images(*)')
      const { data } = UUID_RE.test(idOrSlug)
        ? await query.eq('id', idOrSlug).maybeSingle()
        : await query.eq('slug', idOrSlug).maybeSingle()

      if (!active) return
      if (!data) {
        notFound()
        return
      }
      const product = data as unknown as ProductWithImages
      let hidePhone = false
      if (product.seller_id) {
        const { data: hideRes } = await supabase.rpc('is_seller_phone_hidden', {
          p_seller: product.seller_id,
        })
        hidePhone = hideRes === true
      }
      if (active) setState({ status: 'found', product, hidePhone })
    })()

    return () => {
      active = false
    }
  }, [idOrSlug])

  if (state.status === 'loading') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <>
      <TrackProductView
        productId={state.product.id}
        category={state.product.product_type}
        sellerId={state.product.seller_id}
        name={[state.product.brand, state.product.model].filter(Boolean).join(' ')}
        price={state.product.price}
      />
      <ProductDetailClient product={state.product} sellerHidePhone={state.hidePhone} />
    </>
  )
}
