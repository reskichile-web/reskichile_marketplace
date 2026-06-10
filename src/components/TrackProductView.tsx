'use client'

import { useEffect, useRef } from 'react'
import { track } from '@/lib/track'

/**
 * Beacons a 'product_view' event once per mount. The server page renders
 * this only when the viewer is neither the owner nor an admin, so those
 * views never reach the counter.
 */
export default function TrackProductView({ productId, category }: { productId: string; category: string }) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    track({ type: 'product_view', product_id: productId, category })
  }, [productId, category])

  return null
}
