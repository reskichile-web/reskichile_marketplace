'use client'

import { useEffect, useRef } from 'react'
import { track } from '@/lib/track'
import { createClient } from '@/lib/supabase/client'

/**
 * Beacons a 'product_view' event once per mount, skipping the seller's own
 * visits (resolved client-side via a local getSession()). Admin views are
 * filtered server-side in /api/track, so they never reach the counter either.
 * Self-gating on the client lets the product page stay ISR-cacheable.
 */
export default function TrackProductView({
  productId,
  category,
  sellerId,
}: {
  productId: string
  category: string
  sellerId: string | null
}) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null
      if (uid && sellerId && uid === sellerId) return // owner self-view, skip
      track({ type: 'product_view', product_id: productId, category })
    })
  }, [productId, category, sellerId])

  return null
}
