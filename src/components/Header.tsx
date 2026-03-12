import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import MobileMenu from './MobileMenu'

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
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-blue-600">
          ReskiChile
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-4 text-sm">
          <Link href="/catalogo" className="hover:text-blue-600">
            Catálogo
          </Link>

          {user ? (
            <>
              <Link href="/vender" className="hover:text-blue-600">
                Vender
              </Link>
              <Link href="/mis-productos" className="hover:text-blue-600">
                Mis productos
              </Link>
              <Link href="/perfil" className="hover:text-blue-600">
                Perfil
              </Link>
              {isAdmin && (
                <Link href="/admin" className="hover:text-blue-600 font-medium">
                  Admin
                </Link>
              )}
              <form action="/auth/logout" method="POST">
                <button type="submit" className="hover:text-blue-600">
                  Salir
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="hover:text-blue-600">
                Ingresar
              </Link>
              <Link
                href="/auth/registro"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Registrarse
              </Link>
            </>
          )}
        </nav>

        {/* Mobile menu */}
        <MobileMenu isLoggedIn={!!user} isAdmin={isAdmin} />
      </div>
    </header>
  )
}
