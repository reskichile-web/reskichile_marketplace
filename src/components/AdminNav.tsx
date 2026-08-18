'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  PackageOpen,
  Plus,
  ShoppingBag,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { EASE_OUT_EXPO } from '@/lib/animations'

interface AdminLink {
  label: string
  href: string
  icon: LucideIcon
}

const NAV_ITEMS: AdminLink[] = [
  { label: 'Inicio', href: '/admin', icon: LayoutDashboard },
  { label: 'Publicaciones', href: '/admin/publicaciones', icon: ClipboardCheck },
  { label: 'Inventario', href: '/admin/inventario', icon: Boxes },
  { label: 'Pedidos', href: '/admin/pedidos', icon: ShoppingBag },
  { label: 'Usuarios', href: '/admin/usuarios', icon: Users },
  { label: 'Chats', href: '/admin/chats', icon: MessageCircle },
  { label: 'Mercado', href: '/admin/finanzas', icon: CircleDollarSign },
  { label: 'Métricas', href: '/admin/metricas', icon: BarChart3 },
]

interface Props {
  userName: string
  role: string
  avatarUrl: string | null
}

function isCurrentRoute(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`))
}

export default function AdminNav({ userName, role, avatarUrl }: Props) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const initial = (userName || 'A').charAt(0).toUpperCase()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  function adminLinks(onNavigate?: () => void) {
    return NAV_ITEMS.map((item) => {
      const active = isCurrentRoute(pathname, item.href)
      const Icon = item.icon
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? 'page' : undefined}
          className={`group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors ${
            active
              ? 'bg-brand-500 text-white shadow-sm'
              : 'text-gray-500 hover:bg-brand-50 hover:text-brand-600'
          }`}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.25 : 1.8} />
          <span>{item.label}</span>
        </Link>
      )
    })
  }

  const mobileSidebar = (
    <AnimatePresence>
      {sidebarOpen && (
        <>
          <motion.button
            type="button"
            aria-label="Cerrar menú administrativo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9998] bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            className="fixed inset-y-0 left-0 z-[9999] flex w-[min(82vw,300px)] flex-col bg-white shadow-2xl md:hidden"
            aria-label="Navegación administrativa"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 px-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-500">ReskiChile</p>
                <p className="font-body text-lg font-black text-gray-900">Administración</p>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5">
              {adminLinks(() => setSidebarOpen(false))}
            </nav>

            <div className="shrink-0 border-t border-gray-100 p-4">
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/vender"
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2.5 text-xs font-bold text-white"
                >
                  <Plus className="h-4 w-4" /> Publicar
                </Link>
                <Link
                  href="/mis-productos"
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 px-3 py-2.5 text-xs font-bold text-brand-600"
                >
                  <PackageOpen className="h-4 w-4" /> Mis productos
                </Link>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                <Link href="/perfil" onClick={() => setSidebarOpen(false)} className="flex min-w-0 items-center gap-2.5">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                      {initial}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-gray-700">{userName}</span>
                    <span className="block text-[10px] text-gray-400">{role}</span>
                  </span>
                </Link>
                <form action="/auth/logout" method="POST">
                  <button type="submit" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Cerrar sesión">
                    <LogOut className="h-5 w-5" strokeWidth={1.7} />
                  </button>
                </form>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-gray-100 bg-white shadow-sm md:h-20">
        <div className="flex h-full items-center">
          <div className="relative flex h-full w-full items-center border-gray-100 px-4 md:w-60 md:shrink-0 md:border-r md:px-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
              aria-label="Abrir menú administrativo"
            >
              <Menu className="h-6 w-6" />
            </button>

            <Link href="/" className="absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0">
              <img src="/logo.svg" alt="ReskiChile" className="h-11 w-auto md:h-14" />
            </Link>

            <div className="ml-auto flex items-center gap-1 md:hidden">
              <Link href="/vender" className="rounded-lg p-2 text-brand-500 hover:bg-brand-50" aria-label="Publicar producto">
                <Plus className="h-5 w-5" strokeWidth={2} />
              </Link>
              <Link href="/mis-productos" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" aria-label="Mis productos">
                <PackageOpen className="h-5 w-5" strokeWidth={1.8} />
              </Link>
            </div>
          </div>

          <div className="hidden h-full min-w-0 flex-1 items-center justify-end gap-3 px-6 md:flex lg:px-8">
            <Link
              href="/vender"
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              Publicar producto
            </Link>

            <Link
              href="/mis-productos"
              className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-4 py-2 text-xs font-bold text-brand-600 transition-colors hover:bg-brand-50"
            >
              <PackageOpen className="h-4 w-4" strokeWidth={1.8} />
              Mis productos
            </Link>

            <div className="mx-1 h-7 w-px bg-gray-200" />

            <Link href="/perfil" className="group flex min-w-0 items-center gap-2.5 rounded-lg px-1 py-1">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-9 w-9 rounded-full border-2 border-transparent object-cover transition-colors group-hover:border-brand-200"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-500">
                  {initial}
                </span>
              )}
              <span className="hidden min-w-0 flex-col leading-tight lg:flex">
                <span className="max-w-36 truncate text-xs font-semibold text-gray-800 group-hover:text-brand-500">{userName}</span>
                <span className="text-[10px] font-light italic text-gray-400">{role}</span>
              </span>
              <UserRound className="h-4 w-4 text-gray-300 lg:hidden" strokeWidth={1.6} />
            </Link>

            <form action="/auth/logout" method="POST">
              <button
                type="submit"
                className="rounded-lg p-2 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-600"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-5 w-5" strokeWidth={1.7} />
              </button>
            </form>
          </div>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-20 z-40 hidden w-60 flex-col border-r border-gray-100 bg-white md:flex" aria-label="Navegación administrativa">
        <div className="px-6 pb-3 pt-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-500">Panel</p>
          <h2 className="mt-1 font-body text-xl font-black text-gray-900">Administración</h2>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
          {adminLinks()}
        </nav>
        <div className="border-t border-gray-100 px-5 py-4">
          <p className="truncate text-xs font-semibold text-gray-700">{userName}</p>
          <p className="mt-0.5 text-[10px] text-gray-400">{role}</p>
        </div>
      </aside>

      {mounted && createPortal(mobileSidebar, document.body)}
    </>
  )
}
