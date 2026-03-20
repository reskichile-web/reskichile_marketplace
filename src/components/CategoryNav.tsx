'use client'

import Link from 'next/link'
import { useSearchParams, usePathname } from 'next/navigation'

const CATEGORIES = [
  { key: '', label: 'Todo', href: '/catalogo' },
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

export default function CategoryNav() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const activeType = pathname === '/catalogo' ? (searchParams.get('product_type') || '') : ''

  return (
    <div className="flex items-center justify-center gap-2 h-14 overflow-x-auto">
      {CATEGORIES.map((cat) => {
        const isActive = cat.key === activeType

        return (
          <Link
            key={cat.key}
            href={cat.href || `/catalogo?product_type=${cat.key}`}
            className="relative px-5 py-2.5 text-base font-nav font-bold whitespace-nowrap overflow-hidden group"
          >
            {/* Underline for active, full block on hover */}
            <span className="absolute bottom-0 left-0 right-0 h-0 bg-brand-500 transition-all duration-300 ease-out group-hover:h-full"
              style={{ height: isActive ? '3px' : undefined }}
            />

            {/* Text */}
            <span
              className="relative z-10 transition-colors duration-300 ease-out group-hover:text-white"
              style={{ color: isActive ? '#2674bf' : undefined }}
            >
              {cat.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
