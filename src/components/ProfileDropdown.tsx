'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

export default function ProfileDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="text-gray-900 hover:text-brand-500 transition-colors"
        title="Perfil"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
          <Link
            href="/perfil"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-brand-500 transition-colors"
          >
            Ver perfil
          </Link>
          <form action="/auth/logout" method="POST">
            <button
              type="submit"
              className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-red-500 transition-colors"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
