'use client'

import { useEffect, useRef } from 'react'
import { track } from '@/lib/track'

/**
 * Beacons an 'invite_open' event once when a valid /i/[slug] page loads.
 * A client beacon (not a server-render side effect) so email/WhatsApp link
 * scanners that fetch the HTML without running JS don't produce false opens.
 * /api/track also stamps password_invites.opened_at on first open.
 */
export default function TrackInviteOpen({ slug }: { slug: string }) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    track({ type: 'invite_open', name: slug })
  }, [slug])

  return null
}
