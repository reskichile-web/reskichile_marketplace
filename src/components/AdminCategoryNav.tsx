'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ADMIN_LINKS = [
  { href: '/admin', label: 'Inicio' },
  { href: '/admin/publicaciones', label: 'Publicaciones' },
  { href: '/admin/usuarios', label: 'Usuarios' },
  { href: '/admin/finanzas', label: 'Mercado' },
]

// Admin-side replacement for CategoryNav. Renders in the same horizontal
// strip below the main header row when an admin is inside /admin/*.
export default function AdminCategoryNav() {
  const pathname = usePathname()

  return (
    <div className="flex items-center justify-center gap-2 h-14 overflow-x-auto">
      {ADMIN_LINKS.map((item) => {
        const isActive = pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            className="relative px-5 py-2.5 text-base font-nav font-extralight tracking-wide whitespace-nowrap overflow-hidden group"
          >
            <span
              className="absolute bottom-0 left-0 right-0 h-0 bg-brand-500 transition-all duration-300 ease-out group-hover:h-full"
              style={{ height: isActive ? '3px' : undefined }}
            />
            <span
              className="relative z-10 transition-colors duration-300 ease-out group-hover:text-white"
              style={{ color: isActive ? '#2674bf' : undefined }}
            >
              {item.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
