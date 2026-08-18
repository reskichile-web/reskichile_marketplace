'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { track } from '@/lib/track'

export const ROTATING_CATEGORIES = [
  { label: 'Esquís', type: 'esquis' },
  { label: 'Snowboards', type: 'snowboards' },
  { label: 'Cascos', type: 'cascos' },
  { label: 'Antiparras', type: 'antiparras' },
  { label: 'Parkas', type: 'parkas' },
  { label: 'Botas', type: 'botas_esqui' },
  { label: 'Mochilas', type: 'mochilas' },
  { label: 'Guantes', type: 'guantes' },
  { label: 'Fijaciones', type: 'fijaciones' },
] as const

/**
 * Animation-free rotating word — cycles with a plain CSS opacity fade and no
 * framer-motion. Used as the server/loading render and as the low-internet
 * fallback so slow connections never download the animation library.
 */
export default function RotatingWordStatic() {
  const [index, setIndex] = useState(0)
  const category = ROTATING_CATEGORIES[index]

  useEffect(() => {
    const id = setInterval(() => setIndex((p) => (p + 1) % ROTATING_CATEGORIES.length), 2500)
    return () => clearInterval(id)
  }, [])

  return (
    <Link
      key={category.type}
      href={`/catalogo?product_type=${category.type}`}
      onClick={() => track({ type: 'click', name: 'hero_category', category: category.type })}
      className="inline-flex cursor-pointer align-bottom text-brand-500 [text-shadow:none] transition-colors hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 animate-in fade-in duration-300"
    >
      {category.label}
    </Link>
  )
}
