'use client'

import { OPEN_COOKIE_PREFERENCES_EVENT } from '@/components/MarketingConsent'

export default function CookiePreferencesButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT))}
      className="text-xs text-gray-500 hover:text-gray-300 hover:underline"
    >
      Preferencias de cookies
    </button>
  )
}
