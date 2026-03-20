import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import MobileMenu from './MobileMenu'
import SearchBar from './SearchBar'
import CategoryNav from './CategoryNav'
import AuthModal from './AuthModal'

export default async function Header() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.is_admin ?? false
  }

  return (
    <header className="bg-white shadow-sm">
      {/* Main row: logo + search + user actions */}
      <div>
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-[60px] md:h-[72px] flex items-center gap-3 md:gap-12">
          {/* Mobile: burger menu (categories) — left */}
          <MobileMenu isLoggedIn={!!user} isAdmin={isAdmin} />

          {/* Logo */}
          <Link href="/" className="shrink-0">
            <img src="/logo.svg" alt="ReskiChile" className="h-8 md:h-14" />
          </Link>

          {/* Search — center, takes remaining space */}
          {!isAdmin && (
            <div className="hidden md:block flex-1">
              <SearchBar />
            </div>
          )}

          {/* Right actions — desktop */}
          <div className="hidden md:flex items-center gap-6 shrink-0 font-nav">
            {isAdmin ? (
              <>
                <Link href="/admin" className="text-sm text-gray-900 hover:text-brand-500 transition-colors">
                  Admin
                </Link>
                <form action="/auth/logout" method="POST">
                  <button type="submit" className="text-sm text-gray-900 hover:text-brand-500 transition-colors">
                    Salir
                  </button>
                </form>
              </>
            ) : user ? (
              <>
                <Link href="/mis-productos" className="text-gray-900 hover:text-brand-500 transition-colors" title="Mis productos">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </Link>
                <Link href="/perfil" className="text-gray-900 hover:text-brand-500 transition-colors" title="Perfil">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </Link>
                <form action="/auth/logout" method="POST">
                  <button type="submit" className="text-gray-900 hover:text-brand-500 transition-colors" title="Salir">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </form>
              </>
            ) : (
              <AuthModal />
            )}
            <Link href="/vender" className="bg-brand-500 text-white text-sm px-5 py-2.5 rounded-sm hover:bg-brand-600 transition-colors">
              Vender
            </Link>
          </div>

          {/* Right actions — mobile */}
          <div className="flex md:hidden items-center gap-2 ml-auto">
            {!isAdmin && !user && (
              <>
                <Link href="/auth/login" className="text-[10px] text-gray-400 hover:text-gray-700">
                  Ingresar
                </Link>
                <span className="text-gray-300 text-[10px]">|</span>
                <Link href="/auth/registro" className="text-[10px] text-gray-400 hover:text-gray-700">
                  Registro
                </Link>
              </>
            )}
            {user && !isAdmin && (
              <>
                <Link href="/perfil" className="text-gray-700 p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </Link>
              </>
            )}
            <Link href="/vender" className="bg-brand-500 text-white text-xs px-3 py-1.5 rounded-sm font-medium">
              Vender
            </Link>
          </div>
        </div>
      </div>

      {/* Category nav — second row, desktop only, not for admin */}
      {!isAdmin && (
        <div className="hidden md:block">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <CategoryNav />
          </div>
        </div>
      )}

      {/* Mobile search — below nav */}
      {!isAdmin && (
        <div className="md:hidden px-4 py-2">
          <SearchBar />
        </div>
      )}
    </header>
  )
}
