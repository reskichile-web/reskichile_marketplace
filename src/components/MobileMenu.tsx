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
        <div className="absolute top-[72px] left-0 right-0 bg-white border-b border-gray-200/60 shadow-lg">
          <nav className="flex flex-col p-4 gap-3 text-sm text-gray-600 font-medium">
            {isAdmin ? (
              <>
                <Link href="/admin" onClick={() => setOpen(false)} className="py-2 hover:text-brand-500">
                  Panel de administración
                </Link>
                <form action="/auth/logout" method="POST">
                  <button type="submit" className="py-2 hover:text-brand-500 w-full text-left">
                    Salir
                  </button>
                </form>
              </>
            ) : isLoggedIn ? (
              <>
                <Link href="/catalogo" onClick={() => setOpen(false)} className="py-2 hover:text-brand-500">
                  Catálogo
                </Link>
                <Link href="/vender" onClick={() => setOpen(false)} className="py-2 hover:text-brand-500">
                  Vender
                </Link>
                <Link href="/mis-productos" onClick={() => setOpen(false)} className="py-2 hover:text-brand-500">
                  Mis productos
                </Link>
                <Link href="/perfil" onClick={() => setOpen(false)} className="py-2 hover:text-brand-500">
                  Perfil
                </Link>
                <form action="/auth/logout" method="POST">
                  <button type="submit" className="py-2 hover:text-brand-500 w-full text-left">
                    Salir
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/catalogo" onClick={() => setOpen(false)} className="py-2 hover:text-brand-500">
                  Catálogo
                </Link>
                <Link href="/auth/login" onClick={() => setOpen(false)} className="py-2 hover:text-brand-500">
                  Ingresar
                </Link>
                <Link
                  href="/auth/registro"
                  onClick={() => setOpen(false)}
                  className="bg-brand-500 text-white px-4 py-2 rounded text-center hover:bg-brand-600"
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
