'use client'

import { usePathname } from 'next/navigation'
import MarketingConsent from '@/components/MarketingConsent'

export default function MarketingConsentBoundary() {
  const pathname = usePathname()

  if (pathname.startsWith('/ig-post')) return null
  return <MarketingConsent />
}
