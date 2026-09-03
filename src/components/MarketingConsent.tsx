'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
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
import { track } from '@/lib/track'

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
  const bannerViewTracked = useRef(false)

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

  const resolutionPending = !ready || viewer.loading || resolvedKey !== resolutionKey
  // The consent dialog blocks the page: nothing behind it should scroll while
  // the visitor still has to decide. Meta only ever sees the traffic that
  // grants consent, so an ignorable corner card meant an unusable ad signal.
  const dialogOpen = !pathname.startsWith('/admin') && (activeDecision === null || preferencesOpen)

  useEffect(() => {
    if (!dialogOpen) return
    // A returning visitor keeps the dialog hidden by the bootstrap stylesheet
    // while their stored decision resolves — never freeze the page under an
    // overlay nobody can see. First visits have no stored state and lock now.
    if (
      resolutionPending
      && document.documentElement.dataset.reskiMarketingConsent === 'stored'
    ) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [dialogOpen, resolutionPending])

  // One impression per page load, and only when the dialog is really painted.
  // Acceptance measured over all visitors is meaningless — most never see it.
  // This is the denominator /admin/metricas divides by.
  useEffect(() => {
    if (bannerViewTracked.current) return
    if (!dialogOpen || activeDecision !== null) return
    if (
      resolutionPending
      && document.documentElement.dataset.reskiMarketingConsent === 'stored'
    ) return
    bannerViewTracked.current = true
    track({ type: 'click', name: 'cookie_consent_view', path: pathname })
  }, [activeDecision, dialogOpen, pathname, resolutionPending])

  // Escape only closes the dialog when it was reopened on purpose from the
  // footer. A first, undecided visit has no dismissal path.
  useEffect(() => {
    if (!dialogOpen || activeDecision === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreferencesOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeDecision, dialogOpen])

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
    track({
      type: 'click',
      name: nextChoice === 'granted' ? 'cookie_consent_granted' : 'cookie_consent_denied',
      path: pathname,
    })

    if (viewer.userId) {
      syncAttempt.current = `${viewer.userId}:${decision.choice}:${decision.decidedAt}`
      void saveAccountDecision(decision)
    }
    if (nextChoice === 'denied') revokeMetaPixel()
  }

  const dismissible = activeDecision !== null

  if (!dialogOpen) return null

  return (
    <div
      id="marketing-consent-overlay"
      data-bootstrap-pending={resolutionPending ? 'true' : 'false'}
      role="presentation"
      onMouseDown={event => {
        if (dismissible && event.target === event.currentTarget) setPreferencesOpen(false)
      }}
      className="animate-in fade-in fixed inset-0 z-[10050] flex items-center justify-center bg-gray-950/60 p-4 backdrop-blur-md duration-200"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="marketing-consent-title"
        aria-describedby="marketing-consent-description"
        className="animate-in zoom-in-95 relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto border border-gray-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.35)] duration-200 sm:p-7"
      >
        {dismissible && (
          <button
            type="button"
            onClick={() => setPreferencesOpen(false)}
            aria-label="Cerrar"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <Image src="/favicon.svg" alt="" width={32} height={32} className="h-8 w-8" />
          <h2 id="marketing-consent-title" className="font-body text-xl font-black text-gray-950">
            Política de privacidad
          </h2>
        </div>

        <p id="marketing-consent-description" className="mt-3 text-sm leading-6 text-gray-600">
          Usamos cookies esenciales y, con tu permiso, Meta Pixel para mejorar nuestros anuncios. Rechazar no limita tu experiencia.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => saveChoice('granted')}
            className="min-h-12 w-full bg-brand-500 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Aceptar todo
          </button>
          <button
            type="button"
            onClick={() => saveChoice('denied')}
            className="min-h-11 w-full border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500"
          >
            No, gracias
          </button>
          <Link
            href="/privacidad"
            className="flex min-h-10 items-center justify-center px-3 py-2 text-xs font-bold text-gray-500 underline underline-offset-2 transition-colors hover:text-gray-900"
          >
            Más información
          </Link>
        </div>
      </section>
    </div>
  )
}
