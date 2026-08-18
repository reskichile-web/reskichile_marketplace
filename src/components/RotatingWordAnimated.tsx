'use client'

import { useState, useEffect, useMemo } from 'react'
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

  const letters = useMemo(() => category.label.split(''), [category.label])

  return (
    <span className="inline-flex overflow-hidden align-bottom text-brand-500 [text-shadow:none]">
      <AnimatePresence mode="wait">
        <motion.span
          key={category.type}
          className="inline-flex"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
        >
          <Link
            href={`/catalogo?product_type=${category.type}`}
            onClick={() => track({ type: 'click', name: 'hero_category', category: category.type })}
            className="inline-flex cursor-pointer transition-colors hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            {letters.map((letter, i) => (
              <motion.span
                key={`${category.type}-${i}`}
                className="inline-block origin-bottom"
                exit={{ scaleY: 0 }}
                transition={{
                  duration: 0.2,
                  delay: i * 0.025,
                  ease: [0.76, 0, 0.24, 1],
                }}
              >
                {letter}
              </motion.span>
            ))}
          </Link>
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
