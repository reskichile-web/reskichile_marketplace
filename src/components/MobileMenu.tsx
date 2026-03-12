'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  isLoggedIn: boolean
  isAdmin: boolean
}

export default function MobileMenu({ isLoggedIn, isAdmin }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 -mr-2"
        aria-label="Menú"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute top-14 left-0 right-0 bg-white border-b shadow-lg">
          <nav className="flex flex-col p-4 gap-3 text-sm">
            <Link href="/catalogo" onClick={() => setOpen(false)} className="py-2 hover:text-blue-600">
              Catálogo
            </Link>

            {isLoggedIn ? (
              <>
                <Link href="/vender" onClick={() => setOpen(false)} className="py-2 hover:text-blue-600">
                  Vender
                </Link>
                <Link href="/mis-productos" onClick={() => setOpen(false)} className="py-2 hover:text-blue-600">
                  Mis productos
                </Link>
                <Link href="/perfil" onClick={() => setOpen(false)} className="py-2 hover:text-blue-600">
                  Perfil
                </Link>
                {isAdmin && (
                  <Link href="/admin" onClick={() => setOpen(false)} className="py-2 hover:text-blue-600 font-medium">
                    Admin
                  </Link>
                )}
                <form action="/auth/logout" method="POST">
                  <button type="submit" className="py-2 hover:text-blue-600 w-full text-left">
                    Salir
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/auth/login" onClick={() => setOpen(false)} className="py-2 hover:text-blue-600">
                  Ingresar
                </Link>
                <Link
                  href="/auth/registro"
                  onClick={() => setOpen(false)}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-center hover:bg-blue-700"
                >
                  Registrarse
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </div>
  )
}
