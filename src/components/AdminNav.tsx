'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { EASE_OUT_EXPO } from '@/lib/animations'

const NAV_ITEMS = [
  { label: 'Inicio', href: '/admin' },
  { label: 'Publicaciones', href: '/admin/publicaciones' },
  { label: 'Usuarios', href: '/admin/usuarios' },
  { label: 'Mercado', href: '/admin/finanzas' },
]

export default function AdminNav() {
  const pathname = usePathname()
  const [userName, setUserName] = useState<string>('')
  const [userInitial, setUserInitial] = useState<string>('A')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', user.id)
          .single()
        const name = profile?.name || profile?.email?.split('@')[0] || 'Admin'
        setUserName(name)
        setUserInitial(name.charAt(0).toUpperCase())
      }
    }
    loadUser()
  }, [])

  const sidebar = (
    <AnimatePresence>
      {sidebarOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-[9998]"
            onClick={() => setSidebarOpen(false)}
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            className="fixed top-0 left-0 bottom-0 w-72 bg-white z-[9999] shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-5 h-[56px] border-b border-gray-100">
              <span className="font-body font-black text-lg">Admin</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`block px-3 py-2.5 rounded-md text-sm font-medium ${isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <div className="border-t border-gray-100 pt-3 mt-3">
                <Link href="/vender" onClick={() => setSidebarOpen(false)} className="block w-full text-center bg-brand-500 text-white font-bold text-sm py-2.5 rounded-lg mb-2">
                  Publicar producto
                </Link>
                <Link href="/mis-productos" onClick={() => setSidebarOpen(false)} className="block w-full text-center border border-brand-500 text-brand-500 font-bold text-sm py-2.5 rounded-lg mb-3">
                  Mis productos
                </Link>
                <form action="/auth/logout" method="POST">
                  <button type="submit" className="block py-2 text-sm text-gray-600 hover:text-brand-500 w-full text-left">
                    Cerrar sesión
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center h-20 gap-6">
          {/* Left: Logo + mobile burger */}
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1" aria-label="Menú">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/" className="shrink-0">
              <img src="/logo.svg" alt="ReskiChile" className="h-8" />
            </Link>
          </div>

          {/* Center: Nav items — centered between logo and right buttons — desktop only */}
          <div className="hidden md:flex flex-1 justify-center items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                    ${isActive
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>

          {/* Spacer for mobile (no nav items shown) */}
          <div className="flex-1 md:hidden" />

          {/* Right: Publish + user profile — desktop only */}
          <div className="hidden md:flex items-center gap-4 shrink-0">
            <Link
              href="/vender"
              className="flex items-center gap-1.5 bg-brand-500 text-white text-xs font-medium px-3.5 py-1.5 rounded-md hover:bg-brand-600 transition-all duration-200 shadow-sm hover:shadow"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Publicar producto
            </Link>

            <Link
              href="/mis-productos"
              className="flex items-center gap-1.5 border border-brand-500 text-brand-500 text-xs font-medium px-3.5 py-1.5 rounded-md hover:bg-brand-50 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Mis productos
            </Link>

            {/* Separator */}
            <div className="h-5 w-px bg-gray-200" />

            {/* User profile — avatar + admin badge, no name */}
            <Link href="/perfil" className="flex items-center gap-2 group">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-xs shadow-sm group-hover:shadow transition-shadow">
                {userInitial}
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="#F5B800" stroke="none">
                  <path d="M12 1L9 7l-7 1 5 5-1.5 7L12 17l6.5 3L17 13l5-5-7-1z" />
                </svg>
                <span className="text-[10px] font-bold tracking-widest uppercase leading-tight" style={{ color: '#F5B800' }}>
                  admin
                </span>
              </div>
            </Link>

            {/* Logout */}
            <form action="/auth/logout" method="POST">
              <button type="submit" className="text-gray-300 hover:text-gray-500 transition-colors" title="Cerrar sesión">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
      {mounted && createPortal(sidebar, document.body)}
    </nav>
  )
}
