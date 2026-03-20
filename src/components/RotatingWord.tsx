'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const WORDS = [
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

export default function RotatingWord() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % WORDS.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  const letters = useMemo(() => WORDS[index].split(''), [index])

  return (
    <span className="inline-flex overflow-hidden align-bottom text-brand-500">
      <AnimatePresence mode="wait">
        <motion.span
          key={WORDS[index]}
          className="inline-flex"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {letters.map((letter, i) => (
            <motion.span
              key={`${WORDS[index]}-${i}`}
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
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
