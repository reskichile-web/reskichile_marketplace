'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  {
    label: 'Inicio',
    href: '/admin',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    label: 'Publicaciones',
    href: '/admin/publicaciones',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    label: 'Finanzas',
    href: '/admin/finanzas',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    label: 'Animaciones',
    href: '/admin/animaciones',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
]

export default function AdminNav() {
  const pathname = usePathname()
  const [userName, setUserName] = useState<string>('')
  const [userInitial, setUserInitial] = useState<string>('A')

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

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex items-center justify-between h-[72px]">
          {/* Left: Logo + nav items */}
          <div className="flex items-center gap-10">
            {/* Logo */}
            <Link href="/" className="shrink-0">
              <img src="/logo.svg" alt="ReskiChile" className="h-10" />
            </Link>

            {/* Separator */}
            <div className="h-6 w-px bg-gray-200" />

            {/* Nav items */}
            <div className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                      ${isActive
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                      }
                    `}
                  >
                    <span className={isActive ? 'text-white' : 'text-gray-400'}>{item.icon}</span>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right: Publish + user profile */}
          <div className="flex items-center gap-5">
            <Link
              href="/vender"
              className="flex items-center gap-2 bg-brand-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-brand-600 transition-all duration-200 shadow-sm hover:shadow"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Publicar producto
            </Link>

            {/* Separator */}
            <div className="h-6 w-px bg-gray-200" />

            {/* User profile */}
            <Link href="/perfil" className="flex items-center gap-3 group">
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:shadow transition-shadow">
                {userInitial}
              </div>
              {/* Name + role */}
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-900 leading-tight group-hover:text-brand-500 transition-colors">
                  {userName || '...'}
                </span>
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="#F5B800" stroke="none">
                    <path d="M12 1L9 7l-7 1 5 5-1.5 7L12 17l6.5 3L17 13l5-5-7-1z" />
                  </svg>
                  <span className="text-[10px] font-bold tracking-widest uppercase leading-tight" style={{ color: '#F5B800' }}>
                    admin
                  </span>
                </div>
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
    </nav>
  )
}
