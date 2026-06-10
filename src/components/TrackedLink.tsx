'use client'

import Link from 'next/link'
import { track } from '@/lib/track'

interface Props extends React.ComponentProps<typeof Link> {
  /** Canonical click event name stored in events.event_name (e.g. 'hero_explorar') */
  event: string
  category?: string
  productId?: string
}

/**
 * next/link wrapper that beacons a 'click' analytics event on navigation.
 * Lets server components (e.g. the landing page) emit click events without
 * becoming client components themselves.
 */
export default function TrackedLink({ event, category, productId, onClick, ...linkProps }: Props) {
  return (
    <Link
      {...linkProps}
      onClick={e => {
        track({ type: 'click', name: event, category, product_id: productId })
        onClick?.(e)
      }}
    />
  )
}
