'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

const CATEGORIES = [
  { key: 'trending', label: 'Trending', href: '/catalogo?collection=trending' },
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
  { key: 'all', label: 'Todo', href: '/catalogo' },
]

export default function CategoryNav({ showSkiRacks }: { showSkiRacks: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeType = pathname.startsWith('/ski-rack') || pathname === '/carrito'
    ? 'racks'
    : pathname === '/catalogo'
      ? (searchParams.get('collection') === 'trending' ? 'trending' : searchParams.get('product_type') || null)
      : null

  return (
    <nav className="grid w-full grid-cols-6 items-center gap-1 py-1 lg:grid-flow-col lg:auto-cols-[minmax(max-content,1fr)] lg:grid-cols-none" aria-label="Categorías de equipamiento">
      {CATEGORIES.filter(category => showSkiRacks || category.key !== 'racks').map((category) => {
        const isActive = category.key === 'all'
          ? pathname === '/catalogo' && activeType === null
          : category.key === activeType

        return (
          <Link
            key={category.key}
            href={category.href || `/catalogo?product_type=${category.key}`}
            className={`group relative inline-flex h-12 min-w-0 items-center justify-center whitespace-nowrap px-2 font-nav text-sm tracking-wide xl:px-3 xl:text-base ${category.key === 'trending' ? 'font-bold' : 'font-extralight'} ${category.key === 'racks' || category.key === 'trending' ? 'overflow-visible' : 'overflow-hidden'}`}
          >
            <span
              className={`absolute bottom-0 left-0 right-0 bg-brand-500 transition-all duration-300 ease-out group-hover:h-full ${isActive ? 'h-[3px]' : 'h-0'}`}
            />
            {(category.key === 'racks' || category.key === 'trending') && (
              <span className={`pointer-events-none absolute top-0 left-1 z-20 rounded-sm px-1.5 py-0.5 font-body text-[8px] font-bold uppercase leading-none tracking-wider text-white ${category.key === 'trending' ? 'bg-red-500' : 'bg-brand-400'}`}>
                Nuevo
              </span>
            )}
            <span
              className={`relative z-10 inline-flex items-center gap-1.5 transition-colors duration-300 ease-out group-hover:text-white ${isActive ? 'text-brand-500' : ''}`}
            >
              {category.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
