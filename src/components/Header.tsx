import Link from 'next/link'
import { headers } from 'next/headers'
import { getAuthUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import MobileMenu from './MobileMenu'
import SearchBar from './SearchBar'
import CategoryNav from './CategoryNav'
import AdminCategoryNav from './AdminCategoryNav'
import ProfileDropdown from './ProfileDropdown'
import ChatProvider from './chat/ChatProvider'

export default async function Header() {
  const { user, isAdmin, avatarUrl } = await getAuthUser()
  const pathname = headers().get('x-pathname') || ''
  const inAdminDashboard = pathname.startsWith('/admin')

  let unreadCount = 0
  if (user) {
    const supabase = createServerSupabaseClient()
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
      .neq('sender_id', user.id)
    unreadCount = count ?? 0
  }

  return (
    <ChatProvider userId={user?.id ?? null} initialUnreadCount={unreadCount}>
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
            {user ? (
              <ProfileDropdown avatarUrl={avatarUrl} unreadCountFallback={unreadCount} isAdmin={isAdmin} />
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
            {!user && (
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
            <Link href="/vender" className="pressable bg-brand-500 text-white text-sm px-5 py-2.5 rounded-sm hover:bg-brand-600 transition-colors font-nav">
              Vender
            </Link>
            {user && (
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
                {/* Admin pill — only visible inside the admin dashboard so the
                    rest of the site keeps the regular-user navbar exactly. */}
                {isAdmin && inAdminDashboard ? (
                  <div className="flex items-center gap-2">
                    <ProfileDropdown avatarUrl={avatarUrl} unreadCountFallback={unreadCount} isAdmin={isAdmin} />
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#F5B800' }}>
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 1L9 7l-7 1 5 5-1.5 7L12 17l6.5 3L17 13l5-5-7-1z" />
                      </svg>
                      admin
                    </span>
                  </div>
                ) : (
                  <ProfileDropdown avatarUrl={avatarUrl} unreadCountFallback={unreadCount} isAdmin={isAdmin} />
                )}
              </>
            )}
          </div>

        </div>
      </div>

      {/* Bottom nav strip — desktop only. Categories normally; admin
          shortcuts when an admin is inside /admin/*. */}
      <div className="hidden md:block">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          {isAdmin && inAdminDashboard ? <AdminCategoryNav /> : <CategoryNav />}
        </div>
      </div>
    </header>
    </ChatProvider>
  )
}
