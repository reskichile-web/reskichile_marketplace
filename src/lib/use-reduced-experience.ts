'use client'

import { useEffect, useState } from 'react'

interface NetworkInformation {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g'
  saveData?: boolean
  addEventListener?: (type: 'change', listener: () => void) => void
  removeEventListener?: (type: 'change', listener: () => void) => void
}

function compute(): boolean {
  if (typeof window === 'undefined') return false
  // Data Saver or a slow connection → prefer the lighter, animation-free UI.
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection
  if (conn) {
    if (conn.saveData) return true
    if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g' || conn.effectiveType === '3g') {
      return true
    }
  }
  // Respect the OS "reduce motion" accessibility setting too.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true
  return false
}

/**
 * True when we should render the lighter experience: static instead of animated,
 * and (paired with next/dynamic) skip downloading animation libraries entirely.
 * Triggers on Data Saver, a slow connection (≤3g), or prefers-reduced-motion.
 *
 * Starts false so the server/cached HTML and fast connections render the full
 * experience; flips to true after mount only when the signals say so.
 */
export function useReducedExperience(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const update = () => setReduced(compute())
    update()

    const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection
    conn?.addEventListener?.('change', update)
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    mq?.addEventListener?.('change', update)

    return () => {
      conn?.removeEventListener?.('change', update)
      mq?.removeEventListener?.('change', update)
    }
  }, [])

  return reduced
}
