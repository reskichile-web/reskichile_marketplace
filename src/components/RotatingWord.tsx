'use client'

import dynamic from 'next/dynamic'
import { useReducedExperience } from '@/lib/use-reduced-experience'
import RotatingWordStatic from './RotatingWordStatic'

// The animated version (framer-motion) loads as its own chunk, only on fast
// connections. The server/cached HTML and slow/save-data connections render the
// static word and never download the animation library.
const RotatingWordAnimated = dynamic(() => import('./RotatingWordAnimated'), {
  ssr: false,
  loading: () => <RotatingWordStatic />,
})

export default function RotatingWord() {
  const reduced = useReducedExperience()
  return reduced ? <RotatingWordStatic /> : <RotatingWordAnimated />
}
