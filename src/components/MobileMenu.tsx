'use client'

import { useState } from 'react'
import Link from 'next/link'

const CATEGORIES = [
  { key: 'esquis', label: 'Esquís' },
  { key: 'snowboards', label: 'Snowboards' },
  { key: 'botas_esqui', label: 'Botas Esquí' },
  { key: 'botas_snowboard', label: 'Botas Snow' },
  { key: 'cascos', label: 'Cascos' },
  { key: 'antiparras', label: 'Antiparras' },
  { key: 'parkas', label: 'Parkas' },
  { key: 'pantalones', label: 'Pantalones' },
  { key: 'fijaciones', label: 'Fijaciones' },
]

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
        className="p-1"
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
        <div className="absolute top-[60px] left-0 right-0 bg-white border-b border-gray-200/60 shadow-lg z-50">
          <nav className="p-4">
            {isAdmin ? (
              <div className="space-y-1">
                <Link href="/admin" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium hover:text-brand-500">
                  Panel de administración
                </Link>
                <form action="/auth/logout" method="POST">
                  <button type="submit" className="block py-3 text-sm font-medium hover:text-brand-500 w-full text-left">
                    Salir
                  </button>
                </form>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Categorías</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <Link href="/catalogo" onClick={() => setOpen(false)} className="py-2 text-sm font-medium hover:text-brand-500">
                    Todo
                  </Link>
                  {CATEGORIES.map(cat => (
                    <Link
                      key={cat.key}
                      href={`/catalogo?product_type=${cat.key}`}
                      onClick={() => setOpen(false)}
                      className="py-2 text-sm font-medium hover:text-brand-500"
                    >
                      {cat.label}
                    </Link>
                  ))}
                </div>
                {isLoggedIn && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                    <Link href="/mis-productos" onClick={() => setOpen(false)} className="block py-2 text-sm font-medium hover:text-brand-500">
                      Mis productos
                    </Link>
                    <form action="/auth/logout" method="POST">
                      <button type="submit" className="block py-2 text-sm font-medium hover:text-brand-500 w-full text-left">
                        Salir
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}
          </nav>
        </div>
      )}
    </div>
  )
}
