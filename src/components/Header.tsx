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
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <img src="/logo.svg" alt="ReskiChile" className="h-10 md:h-14" />
          </Link>

          {/* Search — full bar on desktop, icon on mobile */}
          {!isAdmin && (
            <div className="flex-1 md:flex-1 flex justify-end md:justify-start">
              <SearchBar />
            </div>
          )}

          {/* Right actions — desktop */}
          <div className="hidden md:flex items-center gap-6 shrink-0 font-nav">
            {user ? (
              <>
                <Link href="/mis-productos" className="text-gray-900 hover:text-brand-500 transition-colors" title="Mis productos">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </Link>
                <ProfileDropdown />
              </>
            ) : (
              <AuthModal />
            )}
            <Link href="/vender" className="bg-brand-500 text-white text-sm px-5 py-2.5 rounded-sm hover:bg-brand-600 transition-colors">
              Vender
            </Link>
          </div>

          {/* Mobile: sidebar toggle */}
          <MobileMenu isLoggedIn={!!user} isAdmin={isAdmin} />
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
