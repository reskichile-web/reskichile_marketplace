'use client'

import { useEffect, useState } from 'react'
import {
  parseAccountMarketingConsent,
  type MarketingConsentDecision,
} from '@/lib/marketing-consent'
import { createClient } from '@/lib/supabase/client'

export interface Viewer {
  userId: string | null
  isAdmin: boolean
  marketingConsent: MarketingConsentDecision | null
  loading: boolean
}

const ANONYMOUS_VIEWER: Viewer = {
  userId: null,
  isAdmin: false,
  marketingConsent: null,
  loading: true,
}

const ANONYMOUS_RESOLVED: Viewer = {
  userId: null,
  isAdmin: false,
  marketingConsent: null,
  loading: false,
}

/**
 * Resolves permission-sensitive identity from the server cookie. The browser
 * Supabase client can retain an in-memory user briefly after its cookie has
 * been cleared; that stale user must never enable owner/admin controls.
 */
export function useViewer(): Viewer {
  const [viewer, setViewer] = useState<Viewer>(ANONYMOUS_VIEWER)

  useEffect(() => {
    const supabase = createClient()
    let active = true
    let generation = 0
    let controller: AbortController | null = null

    async function refresh() {
      const requestGeneration = ++generation
      controller?.abort()
      controller = new AbortController()
      setViewer((previous) => ({ ...previous, loading: true }))

      try {
        const response = await fetch('/api/auth/viewer', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Viewer session unavailable')

        const data = await response.json() as {
          userId?: unknown
          isAdmin?: unknown
          marketingConsent?: unknown
        }
        if (!active || generation !== requestGeneration) return

        setViewer({
          userId: typeof data.userId === 'string' ? data.userId : null,
          isAdmin: data.isAdmin === true,
          marketingConsent: parseAccountMarketingConsent(data.marketingConsent),
          loading: false,
        })
      } catch (error) {
        if (!active || generation !== requestGeneration) return
        if (error instanceof DOMException && error.name === 'AbortError') return
        setViewer(ANONYMOUS_RESOLVED)
      }
    }

    function clearViewer() {
      generation += 1
      controller?.abort()
      setViewer(ANONYMOUS_RESOLVED)
    }

    void refresh()

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return
      if (event === 'SIGNED_OUT') {
        clearViewer()
        return
      }
      void refresh()
    })

    const handleLogout = () => clearViewer()
    const handlePageShow = () => { void refresh() }
    window.addEventListener('reski:logout', handleLogout)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      active = false
      generation += 1
      controller?.abort()
      window.removeEventListener('reski:logout', handleLogout)
      window.removeEventListener('pageshow', handlePageShow)
      subscription.subscription.unsubscribe()
    }
  }, [])

  return viewer
}
