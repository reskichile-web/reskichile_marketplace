'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useUnreadCount } from './chat/ChatProvider'

interface Props {
  avatarUrl?: string | null
  /**
   * SSR-computed unread count, used as a fallback before the live count from
   * ChatProvider settles. ChatProvider seeds itself with this same value, so
   * in practice they match — but in case a consumer renders ProfileDropdown
   * outside of the provider, this keeps the badge meaningful.
   */
  unreadCountFallback?: number
  isAdmin?: boolean
  email?: string | null
}

export default function ProfileDropdown({ avatarUrl, unreadCountFallback = 0, isAdmin = false, email }: Props) {
  const liveUnreadCount = useUnreadCount()
  const unreadCount = liveUnreadCount ?? unreadCountFallback
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
        className="pressable-subtle relative flex items-center"
        title="Mi cuenta"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-transparent hover:border-brand-200 transition-colors" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-300 transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.6-4.9-9.8-4.9z" />
            </svg>
          </div>
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
          {email && (
            <>
              <p className="px-4 py-2 text-xs text-gray-500 truncate" title={email}>
                {email}
              </p>
              <div className="my-1 border-t border-gray-100" />
            </>
          )}
          {isAdmin && (
            <>
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-amber-50 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#F5B800" stroke="none" aria-hidden="true">
                  <path d="M12 1L9 7l-7 1 5 5-1.5 7L12 17l6.5 3L17 13l5-5-7-1z" />
                </svg>
                Dashboard admin
              </Link>
              <div className="my-1 border-t border-gray-100" />
            </>
          )}
          <Link
            href="/perfil"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-brand-500 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Ver perfil
          </Link>

          {/* Mobile-only: desktop has a dedicated "Mis productos" button in the header */}
          <Link
            href="/mis-productos"
            onClick={() => setOpen(false)}
            className="md:hidden flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-brand-500 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Mis productos
          </Link>

          <Link
            href="/mensajes"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-brand-500 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
            </svg>
            <span className="flex-1">Mis mensajes</span>
            {unreadCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          <div className="my-1 border-t border-gray-100" />

          <form action="/auth/logout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesion
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
