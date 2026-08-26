'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { track } from '@/lib/track'

/**
 * First-party page-view beacon. Fires once per client-side navigation to
 * /api/track (see src/lib/track.ts). On /catalogo it also reports the
 * product_type search param as the viewed category — changing category
 * re-fires, changing other filters (price, brand, region) does not.
 * Must be mounted inside <Suspense> (useSearchParams).
 */
export default function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const last = useRef<string | null>(null)

  const category = pathname === '/catalogo' ? searchParams.get('product_type') : null

  useEffect(() => {
    if (
      !pathname
      || pathname.startsWith('/admin')
      || pathname.startsWith('/ig-post')
    ) return
    const key = `${pathname}|${category ?? ''}`
    if (last.current === key) return
    last.current = key

    track({ type: 'pageview', category: category ?? undefined })
  }, [pathname, category])

  return null
}
