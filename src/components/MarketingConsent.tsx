'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useViewer } from '@/lib/use-viewer'
import {
  MARKETING_CONSENT_KEY,
  createMarketingConsentDecision,
  parseAccountMarketingConsent,
  parseStoredMarketingConsent,
  resolveMarketingConsentDecision,
  serializeMarketingConsent,
  type MarketingConsentChoice,
  type MarketingConsentDecision,
  type StoredMarketingConsent,
} from '@/lib/marketing-consent'
import { loadMetaPixel, revokeMetaPixel, trackMetaPageView } from '@/lib/meta-pixel'

export const OPEN_COOKIE_PREFERENCES_EVENT = 'reski:open-cookie-preferences'

function saveLocalDecision(decision: MarketingConsentDecision) {
  document.documentElement.dataset.reskiMarketingConsent = 'stored'

  try {
    window.localStorage.setItem(
      MARKETING_CONSENT_KEY,
      serializeMarketingConsent(decision.choice, decision.decidedAt),
    )
  } catch {
    // The decision still applies for this page if storage is unavailable.
  }
}

async function saveAccountDecision(decision: MarketingConsentDecision): Promise<void> {
  try {
    await fetch('/api/privacy/marketing-consent', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ choice: decision.choice }),
    })
  } catch {
    // The local choice remains valid and will be synced on the next visit.
  }
}

export default function MarketingConsent() {
  const pathname = usePathname()
  const viewer = useViewer()
  const [ready, setReady] = useState(false)
  const [localDecision, setLocalDecision] = useState<StoredMarketingConsent | null>(null)
  const [activeDecision, setActiveDecision] = useState<MarketingConsentDecision | null>(null)
  const [resolvedKey, setResolvedKey] = useState<string | null>(null)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const syncAttempt = useRef<string | null>(null)

  const identity = viewer.userId ?? 'anonymous'
  const resolutionKey = useMemo(() => {
    const account = viewer.marketingConsent
    return `${identity}:${account?.choice ?? 'none'}:${account?.version ?? 0}:${account?.decidedAt ?? 0}`
  }, [identity, viewer.marketingConsent])

  useEffect(() => {
    let stored: StoredMarketingConsent | null = null
    try {
      stored = parseStoredMarketingConsent(window.localStorage.getItem(MARKETING_CONSENT_KEY))
    } catch {
      stored = null
    }
    setLocalDecision(stored)
    setReady(true)
  }, [])

  useEffect(() => {
    const openPreferences = () => setPreferencesOpen(true)
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, openPreferences)
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, openPreferences)
  }, [])

  useEffect(() => {
    if (!ready || viewer.loading) return

    const accountDecision = parseAccountMarketingConsent(viewer.marketingConsent)
    const nextDecision = resolveMarketingConsentDecision(localDecision, accountDecision)

    setActiveDecision(nextDecision)
    setResolvedKey(resolutionKey)

    // A local choice belongs to this browser, regardless of which account is
    // currently signed in. Never replace it merely because identity changed.
    if (localDecision) {
      if (viewer.userId && !accountDecision) {
        const syncKey = `${viewer.userId}:${localDecision.choice}:${localDecision.decidedAt}`
        if (syncAttempt.current !== syncKey) {
          syncAttempt.current = syncKey
          void saveAccountDecision(localDecision)
        }
      }
      return
    }

    // On a new device, reuse the account choice once and persist it locally.
    if (viewer.userId && accountDecision) {
      setLocalDecision(accountDecision)
      saveLocalDecision(accountDecision)
    }
  }, [localDecision, ready, resolutionKey, viewer.loading, viewer.marketingConsent, viewer.userId])

  useEffect(() => {
    if (!ready || viewer.loading || resolvedKey !== resolutionKey) return
    if (activeDecision?.choice !== 'granted' || viewer.isAdmin || pathname.startsWith('/admin')) {
      revokeMetaPixel()
      return
    }

    loadMetaPixel()
    trackMetaPageView(pathname)
  }, [activeDecision, pathname, ready, resolutionKey, resolvedKey, viewer.isAdmin, viewer.loading])

  function saveChoice(nextChoice: MarketingConsentChoice) {
    const decision = createMarketingConsentDecision(nextChoice)

    // Close optimistically. Local persistence and account sync must never keep
    // the consent card visible after the visitor has already made a choice.
    setPreferencesOpen(false)
    setLocalDecision(decision)
    setActiveDecision(decision)
    saveLocalDecision(decision)

    if (viewer.userId) {
      syncAttempt.current = `${viewer.userId}:${decision.choice}:${decision.decidedAt}`
      void saveAccountDecision(decision)
    }
    if (nextChoice === 'denied') revokeMetaPixel()
  }

  const resolutionPending = !ready || viewer.loading || resolvedKey !== resolutionKey

  if (pathname.startsWith('/admin')) return null
  if (activeDecision !== null && !preferencesOpen) return null

  return (
    <section
      id="marketing-consent-overlay"
      data-bootstrap-pending={resolutionPending ? 'true' : 'false'}
      role="dialog"
      aria-labelledby="marketing-consent-title"
      className="fixed bottom-3 left-3 right-3 z-[100] max-h-[calc(100dvh-1.5rem)] overflow-y-auto border border-gray-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.24)] sm:bottom-6 sm:left-6 sm:right-auto sm:w-full sm:max-w-md sm:p-6"
    >
      <div className="flex items-center gap-3">
        <Image src="/favicon.svg" alt="" width={36} height={36} className="h-9 w-9" />
        <h2 id="marketing-consent-title" className="font-body text-xl font-black text-gray-950">
          Política de privacidad
        </h2>
      </div>

      <p className="mt-4 text-sm leading-6 text-gray-700 sm:text-[15px]">
        Usamos cookies necesarias para que el marketplace funcione. Con tu permiso, Meta Pixel nos ayuda a saber qué anuncios acercan compradores reales y a mejorar nuestras campañas.
      </p>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        Rechazar no limita el catálogo ni el contacto por WhatsApp.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => saveChoice('granted')}
          className="min-h-12 bg-brand-500 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          Aceptar todo
        </button>
        <button
          type="button"
          onClick={() => saveChoice('denied')}
          className="min-h-12 border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-900 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500"
        >
          Rechazar todo
        </button>
        <Link
          href="/privacidad"
          className="col-span-2 flex min-h-12 items-center justify-center border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-900 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500"
        >
          Más información
        </Link>
      </div>
    </section>
  )
}
