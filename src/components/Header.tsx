'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSessionAuth } from '@/lib/use-session-auth'
import MobileMenu from './MobileMenu'
import SearchBar from './SearchBar'
import CategoryNav from './CategoryNav'
import ProfileDropdown from './ProfileDropdown'
import ChatProvider from './chat/ChatProvider'

// Client component on purpose: it reads the auth session in the browser so the
// surrounding pages stay ISR-cacheable (no server-side cookies()). The static
// shell (logo, search, nav, "Vender") renders identically for everyone; the
// login/avatar area hydrates once the session resolves. The eternal-login cookie
// is untouched — middleware still refreshes it on every request.
export default function Header() {
  const { userId, email, isAdmin, avatarUrl, unreadCount } = useSessionAuth()

  return (
    <ChatProvider userId={userId} initialUnreadCount={unreadCount}>
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
            <MobileMenu isAdmin={isAdmin} />
          </div>

          {/* Logo — centered on mobile, left on desktop */}
          <Link href="/" className="shrink-0 md:shrink-0 absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0">
            <img src="/logo.svg" alt="ReskiChile" className="h-12 md:h-14" />
          </Link>

          {/* Desktop: search bar */}
          <div className="hidden md:block flex-1">
            <SearchBar />
          </div>

          {/* Right actions — mobile */}
          <div className="md:hidden flex items-center gap-3 ml-auto">
            <SearchBar />
            {userId ? (
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
            {!userId && (
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
            <Link href="/vender" className="pressable bg-brand-500 text-white text-sm px-5 py-1.5 rounded-none hover:bg-brand-600 transition-colors font-nav">
              Vender
            </Link>
            {userId && (
              <>
                <Link
                  href="/mis-productos"
                  className="pressable inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm px-4 py-2.5 rounded-sm hover:border-brand-300 hover:text-brand-500 transition-colors font-nav"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Mis productos
                </Link>
                <ProfileDropdown avatarUrl={avatarUrl} unreadCountFallback={unreadCount} isAdmin={isAdmin} email={email ?? undefined} />
              </>
            )}
          </div>

        </div>
      </div>

      {/* Category nav — desktop only */}
      <div className="hidden md:block">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <Suspense fallback={null}>
            <CategoryNav />
          </Suspense>
        </div>
      </div>
    </header>
    </ChatProvider>
  )
}
