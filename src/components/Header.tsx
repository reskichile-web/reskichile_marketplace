import Link from 'next/link'
import { getAuthUser } from '@/lib/auth'
import MobileMenu from './MobileMenu'
import SearchBar from './SearchBar'
import CategoryNav from './CategoryNav'
import AdminNav from './AdminNav'
import ProfileDropdown from './ProfileDropdown'

export default async function Header() {
  const { user, isAdmin } = await getAuthUser()

  if (isAdmin) return <AdminNav />

  return (
    <header className="bg-white shadow-sm">
      {/* Main row */}
      <div>
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-[60px] md:h-[72px] flex items-center gap-3 md:gap-12">
          {/* Mobile: menu left */}
          <div className="md:hidden">
            <MobileMenu isLoggedIn={!!user} isAdmin={isAdmin} />
          </div>

          {/* Logo — centered on mobile, left on desktop */}
          <Link href="/" className="shrink-0 md:shrink-0 absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0">
            <img src="/logo.svg" alt="ReskiChile" className="h-12 md:h-14" />
          </Link>

          {/* Desktop: search bar */}
          {!isAdmin && (
            <div className="hidden md:block flex-1">
              <SearchBar />
            </div>
          )}

          {/* Right actions — mobile */}
          <div className="md:hidden flex items-center gap-3 ml-auto">
            {!isAdmin && <SearchBar />}
            {user ? (
              <ProfileDropdown />
            ) : (
              <Link href="/auth/login" className="p-1" aria-label="Iniciar sesión">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </Link>
            )}
          </div>

          {/* Right actions — desktop */}
          <div className="hidden md:flex items-center gap-5 shrink-0 font-nav">
            {user ? (
              <>
                <Link href="/mis-productos" className="text-sm text-gray-600 hover:text-brand-500 transition-colors">
                  Mis productos
                </Link>
                <Link href="/perfil" className="text-sm text-gray-600 hover:text-brand-500 transition-colors">
                  Perfil
                </Link>
                <form action="/auth/logout" method="POST">
                  <button type="submit" className="text-sm text-gray-400 hover:text-red-500 transition-colors">
                    Salir
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                  Iniciar sesión
                </Link>
                <span className="text-gray-200">|</span>
                <Link href="/auth/registro" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                  Registrarse
                </Link>
              </>
            )}
            <Link href="/vender" className="pressable bg-brand-500 text-white text-sm px-5 py-2.5 rounded-sm hover:bg-brand-600 transition-colors">
              Vender
            </Link>
          </div>

        </div>
      </div>

      {/* Category nav — desktop only */}
      {!isAdmin && (
        <div className="hidden md:block">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <CategoryNav />
          </div>
        </div>
      )}
    </header>
  )
}
