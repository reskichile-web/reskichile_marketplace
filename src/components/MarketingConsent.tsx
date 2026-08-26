'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useViewer } from '@/lib/use-viewer'
import {
  MARKETING_CONSENT_KEY,
  parseMarketingConsent,
  serializeMarketingConsent,
  type MarketingConsentChoice,
} from '@/lib/marketing-consent'
import { loadMetaPixel, revokeMetaPixel, trackMetaPageView } from '@/lib/meta-pixel'

export const OPEN_COOKIE_PREFERENCES_EVENT = 'reski:open-cookie-preferences'

export default function MarketingConsent() {
  const pathname = usePathname()
  const viewer = useViewer()
  const [ready, setReady] = useState(false)
  const [choice, setChoice] = useState<MarketingConsentChoice | null>(null)
  const [preferencesOpen, setPreferencesOpen] = useState(false)

  useEffect(() => {
    try {
      setChoice(parseMarketingConsent(window.localStorage.getItem(MARKETING_CONSENT_KEY)))
    } catch {
      setChoice(null)
    }
    setReady(true)
  }, [])

  useEffect(() => {
    const openPreferences = () => setPreferencesOpen(true)
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, openPreferences)
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, openPreferences)
  }, [])

  useEffect(() => {
    if (!ready || viewer.loading) return
    if (choice !== 'granted' || viewer.isAdmin || pathname.startsWith('/admin')) {
      revokeMetaPixel()
      return
    }

    loadMetaPixel()
    trackMetaPageView(pathname)
  }, [choice, pathname, ready, viewer.isAdmin, viewer.loading])

  function saveChoice(nextChoice: MarketingConsentChoice) {
    try {
      window.localStorage.setItem(MARKETING_CONSENT_KEY, serializeMarketingConsent(nextChoice))
    } catch {
      // The decision still applies for this page even if storage is unavailable.
    }

    if (nextChoice === 'denied') revokeMetaPixel()
    setChoice(nextChoice)
    setPreferencesOpen(false)
  }

  if (!ready || pathname.startsWith('/admin') || (choice !== null && !preferencesOpen)) return null

  return (
    <section
      role="dialog"
      aria-label="Preferencias de cookies"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl border border-gray-200 bg-white p-4 shadow-2xl sm:inset-x-6 sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <h2 className="font-body text-base font-black text-gray-950">Tu privacidad</h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            Usamos cookies necesarias para operar el sitio. Con tu permiso, Meta Pixel nos ayuda a medir campañas y mejorar los anuncios. Rechazar no limita el catálogo ni el contacto por WhatsApp.
          </p>
          <Link href="/privacidad" className="mt-1 inline-block text-xs font-semibold text-brand-600 hover:underline">
            Más información
          </Link>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => saveChoice('denied')}
            className="min-w-28 border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => saveChoice('granted')}
            className="min-w-28 bg-brand-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-600"
          >
            Aceptar
          </button>
        </div>
      </div>
    </section>
  )
}
