import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import MobileMenu from './MobileMenu'
import SearchBar from './SearchBar'
import CategoryNav from './CategoryNav'
import AuthModal from './AuthModal'
import AdminNav from './AdminNav'
import ProfileDropdown from './ProfileDropdown'

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

          {/* Mobile: search right */}
          {!isAdmin && (
            <div className="md:hidden ml-auto">
              <SearchBar />
            </div>
          )}

          {/* Desktop: search bar */}
          {!isAdmin && (
            <div className="hidden md:block flex-1">
              <SearchBar />
            </div>
          )}

          {/* Right actions — desktop: full links */}
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
              <AuthModal />
            )}
            <Link href="/vender" className="bg-brand-500 text-white text-sm px-5 py-2.5 rounded-sm hover:bg-brand-600 transition-colors">
              Vender
            </Link>
          </div>

          {/* Right actions — mobile: profile dropdown */}
          {user && (
            <div className="md:hidden ml-auto">
              <ProfileDropdown />
            </div>
          )}

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
