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

export default function CategoryNav({ showSkiRacks }: { showSkiRacks: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeType = pathname.startsWith('/ski-rack') || pathname === '/carrito'
    ? 'racks'
    : pathname === '/catalogo'
      ? (searchParams.get('product_type') || null)
      : null

  return (
    <nav className="flex h-14 items-center justify-center gap-2 overflow-x-auto" aria-label="Categorías de equipamiento">
      {CATEGORIES.filter(category => showSkiRacks || category.key !== 'racks').map((category) => {
        const isActive = category.key === activeType

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
