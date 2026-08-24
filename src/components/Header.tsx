'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PackageOpen } from 'lucide-react'
import { useSessionAuth } from '@/lib/use-session-auth'
import SellTagIcon from './SellTagIcon'
import MobileMenu from './MobileMenu'
import SearchBar from './SearchBar'
import CategoryNav from './CategoryNav'
import ProfileDropdown from './ProfileDropdown'
import ChatProvider from './chat/ChatProvider'
import SkiRackCartLink from './SkiRackCartLink'
import SkiRackCartDrawerHost from './SkiRackCartDrawerHost'

// Client component on purpose: it reads the auth session in the browser so the
// surrounding pages stay ISR-cacheable (no server-side cookies()). The static
// shell (logo, search, nav, "Vender") renders identically for everyone; the
// login/avatar area hydrates once the session resolves. The eternal-login cookie
// is untouched — middleware still refreshes it on every request.
export default function Header() {
  const { userId, email, isAdmin, avatarUrl, unreadCount, loading } = useSessionAuth()
  const pathname = usePathname()
  const [showSkiRacks, setShowSkiRacks] = useState(process.env.NODE_ENV !== 'production')
  const showEmptySkiRackCart = pathname.startsWith('/ski-rack') || pathname === '/carrito'

  useEffect(() => {
    let cancelled = false

    fetch('/api/racks/visibility', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json() as { enabled?: boolean }
        if (!cancelled) setShowSkiRacks(response.ok && data.enabled === true)
      })
      .catch(() => {
        if (!cancelled) setShowSkiRacks(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <ChatProvider userId={userId} initialUnreadCount={unreadCount}>
    <>
    <header className="bg-white shadow-sm">
      {/* Preload avatar image for instant display */}
      {avatarUrl && (
        <link rel="preload" as="image" href={avatarUrl} />
      )}
      {/* Main row */}
      <div>
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-[60px] md:h-[72px] flex items-center gap-3 md:gap-12">
          {/* Mobile: menu left */}
          <div className="md:hidden">
            <MobileMenu isAdmin={isAdmin} showSkiRacks={showSkiRacks} />
          </div>

          {/* Logo — centered on mobile, left on desktop */}
          <Link href="/" className="absolute left-1/2 shrink-0 -translate-x-1/2 md:static md:translate-x-0">
            <img src="/logo.svg" alt="ReskiChile" className="hidden h-10 min-[350px]:block md:h-14" />
            <img src="/favicon.svg" alt="ReskiChile" className="h-9 min-[350px]:hidden" />
          </Link>

          {/* Desktop: search bar */}
          <div className="hidden md:block flex-1">
            <SearchBar />
          </div>

          {/* Right actions — mobile */}
          <div className="ml-auto flex shrink-0 items-center gap-2 md:hidden">
            <SearchBar />
            {showSkiRacks && <SkiRackCartLink showWhenEmpty={showEmptySkiRackCart} />}
            {loading ? (
              <span className="h-9 w-10 shrink-0 rounded-full bg-gray-100" aria-hidden="true" />
            ) : userId ? (
              <ProfileDropdown avatarUrl={avatarUrl} unreadCountFallback={unreadCount} isAdmin={isAdmin} email={email ?? undefined} />
            ) : (
              <Link href="/auth/login" className="p-1" aria-label="Iniciar sesion">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </Link>
            )}
          </div>

          {/* Right actions — desktop */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <Link href="/vender" className="pressable inline-flex h-9 items-center justify-center gap-1.5 bg-brand-500 px-5 text-sm font-bold text-white transition-colors hover:bg-brand-600 font-nav">
              <SellTagIcon className="h-4 w-4" />
              Vender
            </Link>
            {!loading && !userId && (
              <>
                <Link href="/auth/login" className="text-xs text-gray-400 hover:text-gray-700 transition-colors font-nav">
                  Iniciar sesion
                </Link>
                <span className="text-gray-200">|</span>
                <Link href="/auth/registro" className="text-xs text-gray-400 hover:text-gray-700 transition-colors font-nav">
                  Registrarse
                </Link>
              </>
            )}
            {!loading && userId && (
              <Link
                href="/mis-productos"
                className="pressable inline-flex h-9 items-center gap-2 rounded-sm border border-brand-200 bg-white px-4 text-sm text-brand-600 transition-colors hover:border-brand-300 hover:bg-brand-50 font-nav"
              >
                <PackageOpen className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                Mis productos
              </Link>
            )}
            {showSkiRacks && <SkiRackCartLink showWhenEmpty={showEmptySkiRackCart} />}
            {loading && (
              <span className="h-9 w-[198px] shrink-0 rounded-sm bg-gray-100" aria-hidden="true" />
            )}
            {!loading && userId && (
              <ProfileDropdown avatarUrl={avatarUrl} unreadCountFallback={unreadCount} isAdmin={isAdmin} email={email ?? undefined} />
            )}
          </div>

        </div>
      </div>

      {/* Category nav — desktop only */}
      <div className="hidden md:block">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <Suspense fallback={null}>
            <CategoryNav showSkiRacks={showSkiRacks} />
          </Suspense>
        </div>
      </div>
    </header>
    {showSkiRacks && <SkiRackCartDrawerHost />}
    </>
    </ChatProvider>
  )
}
