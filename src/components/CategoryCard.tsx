'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useReducedExperience } from '@/lib/use-reduced-experience'
import CategoryCardStatic from './CategoryCardStatic'
import type { CategoryCardProps } from './CategoryCardAnimated'

// Animated version (framer-motion) loads as its own chunk, only on fast
// connections. The cached HTML and slow / save-data connections render the
// CSS-only static card and never download the animation library. The static
// card is the resting visual of the animated one, so the upgrade is seamless.
const CategoryCardAnimated = dynamic(() => import('./CategoryCardAnimated'), { ssr: false })

export default function CategoryCard(props: CategoryCardProps) {
  const reduced = useReducedExperience()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted || reduced) return <CategoryCardStatic {...props} />
  return <CategoryCardAnimated {...props} />
}
