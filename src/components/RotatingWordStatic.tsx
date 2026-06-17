'use client'

import { useState, useEffect } from 'react'

export const WORDS = [
  'Esquís',
  'Snowboards',
  'Cascos',
  'Antiparras',
  'Parkas',
  'Botas',
  'Mochilas',
  'Guantes',
  'Fijaciones',
]

/**
 * Animation-free rotating word — cycles with a plain CSS opacity fade and no
 * framer-motion. Used as the server/loading render and as the low-internet
 * fallback so slow connections never download the animation library.
 */
export default function RotatingWordStatic() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setIndex((p) => (p + 1) % WORDS.length), 2500)
    return () => clearInterval(id)
  }, [])

  return (
    <span
      key={WORDS[index]}
      className="inline-flex align-bottom text-brand-500 [text-shadow:none] animate-in fade-in duration-300"
    >
      {WORDS[index]}
    </span>
  )
}
