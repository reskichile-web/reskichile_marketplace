'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { EASE_OUT_EXPO } from '@/lib/animations'
import { ROTATING_CATEGORIES } from './RotatingWordStatic'
import { track } from '@/lib/track'

// framer-motion lives here so it ships in its own chunk: only fast connections
// load it (see RotatingWord dispatcher). Slow / save-data render the static word.
export default function RotatingWordAnimated() {
  const [index, setIndex] = useState(0)
  const category = ROTATING_CATEGORIES[index]

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % ROTATING_CATEGORIES.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <span className="relative block h-full w-full overflow-hidden text-brand-500 [text-shadow:none]">
      <AnimatePresence initial={false}>
        <motion.span
          key={category.type}
          className="absolute inset-x-0 top-0 inline-flex"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
        >
          <Link
            href={`/catalogo?product_type=${category.type}`}
            onClick={() => track({ type: 'click', name: 'hero_category', category: category.type })}
            className="inline-flex cursor-pointer transition-colors hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            {category.label}
          </Link>
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
