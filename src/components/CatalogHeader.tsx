import Link from 'next/link'
import { getAuthUser } from '@/lib/auth'
import ProfileDropdown from './ProfileDropdown'
import MobileMenu from './MobileMenu'

export default async function CatalogHeader({
  mobileMenu,
  mobileExtras,
}: {
  mobileMenu?: React.ReactNode
  mobileExtras?: React.ReactNode
} = {}) {
  const { user, isAdmin, avatarUrl, userName } = await getAuthUser()

  return (
    <header className="bg-white shadow-lg rounded-b-2xl">
      {avatarUrl && <link rel="preload" as="image" href={avatarUrl} />}
      {/* Mobile: 3-column grid (burger | logo | user) */}
      <div className="md:hidden grid grid-cols-[auto_1fr_auto] items-center px-3 h-[56px]">
        <div className="justify-self-start">
          {mobileMenu ?? <MobileMenu isAdmin={isAdmin} />}
        </div>
        <Link href="/" className="justify-self-center">
          <img src="/logo.svg" alt="ReskiChile" className="h-9" />
        </Link>
        <div className="justify-self-end flex items-center gap-2">
          {mobileExtras}
          {user ? (
            <ProfileDropdown avatarUrl={avatarUrl} userName={userName} />
          ) : (
            <Link
              href="/auth/login"
              aria-label="Iniciar sesion"
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
          )}
        </div>
      </div>

      {/* Desktop: original layout */}
      <div className="hidden md:flex px-6 h-[72px] items-center gap-6">
        <Link href="/" className="shrink-0">
          <img src="/logo.svg" alt="ReskiChile" className="h-12" />
        </Link>
        <div className="flex items-center gap-3 ml-auto shrink-0">
          {user ? (
            <ProfileDropdown avatarUrl={avatarUrl} userName={userName} />
          ) : (
            <>
              <Link
                href="/auth/login"
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors font-nav"
              >
                Iniciar sesion
              </Link>
              <span className="text-gray-200">|</span>
              <Link
                href="/auth/registro"
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors font-nav"
              >
                Registrarse
              </Link>
            </>
          )}
          <Link
            href="/vender"
            className="pressable bg-brand-500 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-brand-600 transition-colors font-nav"
          >
            Vender
          </Link>
        </div>
      </div>
    </header>
  )
}
