'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

const CATEGORIES = [
  { key: 'racks', label: 'Racks', href: '/ski-rack' },
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

type MenuItem = {
  label: string
  href: string
  icon?: React.ReactNode
}

const marketplaceItems: MenuItem[] = CATEGORIES
  .filter((category) => category.key !== 'racks')
  .map((category) => ({
    label: category.label,
    href: category.href || `/catalogo?product_type=${category.key}`,
  }))

const installationItems: MenuItem[] = [
  {
    label: 'Instructivo',
    href: '/ski-rack#instructivo',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 5.25A2.25 2.25 0 016.75 3h10.5a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0117.25 21H6.75a2.25 2.25 0 01-2.25-2.25V5.25zM8 7.5h8M8 11h8M8 14.5h5" />
      </svg>
    ),
  },
  {
    label: 'Video demostración',
    href: '/ski-rack#video',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m10 8.75 5 3.25-5 3.25v-6.5z" />
      </svg>
    ),
  },
]

const supportItems: MenuItem[] = [
  {
    label: 'Contacto',
    href: 'mailto:reskichile@gmail.com?subject=Contacto%20ReskiChile',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75A2.25 2.25 0 016 4.5h12a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0118 19.5H6a2.25 2.25 0 01-2.25-2.25V6.75z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 7.5 6.08 4.05a2.55 2.55 0 002.84 0L19.5 7.5" />
      </svg>
    ),
  },
  {
    label: 'Devolución',
    href: 'mailto:reskichile@gmail.com?subject=Solicitud%20de%20devoluci%C3%B3n',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7H5v-4M5.35 6.65A8.5 8.5 0 112.9 13" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 11h6v6H9z" />
      </svg>
    ),
  },
]

function Dropdown({ label, items, columns = 1 }: { label: string; items: MenuItem[]; columns?: 1 | 2 }) {
  return (
    <div className="group relative flex h-full items-center">
      <button
        type="button"
        className="relative overflow-hidden whitespace-nowrap px-5 py-2.5 font-nav text-base font-extralight tracking-wide focus-visible:outline-none"
        aria-haspopup="menu"
      >
        <span className="absolute bottom-0 left-0 right-0 h-0 bg-brand-500 transition-all duration-300 ease-out group-hover:h-full group-focus-within:h-full" />
        <span className="relative z-10 flex items-center gap-1.5 transition-colors duration-300 ease-out group-hover:text-white group-focus-within:text-white">
          {label}
          <svg className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      <div
        className={`invisible absolute left-1/2 top-[calc(100%-2px)] z-50 grid -translate-x-1/2 translate-y-2 border border-gray-100 bg-white p-2 opacity-0 shadow-xl transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 ${
          columns === 2 ? 'w-80 grid-cols-2' : 'w-64 grid-cols-1'
        }`}
        role="menu"
      >
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-brand-50 hover:text-brand-600"
            role="menuitem"
          >
            {item.icon && <span className="text-brand-500">{item.icon}</span>}
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function CategoryNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isSkiRackRoute = pathname.startsWith('/ski-rack') || pathname === '/carrito'

  if (!isSkiRackRoute) {
    const activeType = pathname === '/catalogo' ? (searchParams.get('product_type') || null) : null

    return (
      <nav className="flex h-14 items-center justify-center gap-2 overflow-x-auto" aria-label="Categorías de equipamiento">
        {CATEGORIES.map((category) => {
          const isActive = activeType !== null && category.key === activeType

          return (
            <Link
              key={category.key}
              href={category.href || `/catalogo?product_type=${category.key}`}
              className={`group relative whitespace-nowrap px-5 py-2.5 font-nav text-base font-extralight tracking-wide ${category.key === 'racks' ? 'overflow-visible' : 'overflow-hidden'}`}
            >
              <span
                className="absolute bottom-0 left-0 right-0 h-0 bg-brand-500 transition-all duration-300 ease-out group-hover:h-full"
                style={{ height: isActive ? '3px' : undefined }}
              />
              {category.key === 'racks' && (
                <span className="pointer-events-none absolute top-0 left-1 z-20 rounded-sm bg-brand-400 px-1.5 py-0.5 font-body text-[8px] font-bold uppercase leading-none tracking-wider text-white">
                  Nuevo
                </span>
              )}
              <span
                className="relative z-10 transition-colors duration-300 ease-out group-hover:text-white"
                style={{ color: isActive ? '#2674bf' : undefined }}
              >
                {category.label}
              </span>
            </Link>
          )
        })}
      </nav>
    )
  }

  function RackLink({ href, label, active = false }: { href: string; label: string; active?: boolean }) {
    return (
      <Link
        href={href}
        className="group relative overflow-hidden whitespace-nowrap px-5 py-2.5 font-nav text-base font-extralight tracking-wide"
      >
        <span
          className="absolute bottom-0 left-0 right-0 h-0 bg-brand-500 transition-all duration-300 ease-out group-hover:h-full"
          style={{ height: active ? '3px' : undefined }}
        />
        <span
          className="relative z-10 transition-colors duration-300 ease-out group-hover:text-white"
          style={{ color: active ? '#2674bf' : undefined }}
        >
          {label}
        </span>
      </Link>
    )
  }

  return (
    <nav className="flex h-14 items-center justify-center gap-2 overflow-visible" aria-label="Navegación Ski Rack">
      <Dropdown label="Marketplace" items={marketplaceItems} columns={2} />
      <RackLink href="/ski-rack" label="Catálogo" active={pathname.startsWith('/ski-rack')} />
      <Dropdown label="Instalación" items={installationItems} />
      <Dropdown label="Soporte" items={supportItems} />
    </nav>
  )
}
