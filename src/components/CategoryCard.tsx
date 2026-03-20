'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

const GEAR_CATEGORIES = new Set(['esquis', 'botas_esqui', 'snowboards', 'cascos'])
const AI_CATEGORIES = new Set(['esquis'])

interface Props {
  type: string
  label: string
  count: number
  image: string
}

export default function CategoryCard({ type, label, image }: Props) {
  const [active, setActive] = useState(false)
  const isGear = GEAR_CATEGORIES.has(type)
  const hasAI = AI_CATEGORIES.has(type)
  const linkCount = (isGear ? 1 : 0) + 2 + (hasAI ? 1 : 0)

  return (
    <div
      className="relative block aspect-square overflow-hidden rounded-xl cursor-pointer"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onClick={() => setActive(prev => !prev)}
    >
      {/* Image with zoom */}
      <motion.img
        src={image}
        alt={label}
        className="absolute inset-0 w-full h-full object-cover"
        animate={{ scale: active ? 1.1 : 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        loading="lazy"
      />

      {/* Overlay — darker on active */}
      <motion.div
        className="absolute inset-0"
        animate={{ backgroundColor: active ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.35)' }}
        transition={{ duration: 0.3 }}
      />

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end p-4 md:p-6">
        {/* Title — slides up on active */}
        <motion.div
          animate={{ y: active ? -(linkCount * 24 + 12) : 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="font-body text-xl md:text-3xl font-black text-white block">
            {label}
          </span>
        </motion.div>

        {/* Links — appear on active */}
        <AnimatePresence>
          {active && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="absolute bottom-4 md:bottom-6 left-4 md:left-6 right-4 md:right-6 space-y-2"
              onClick={e => e.stopPropagation()}
            >
              {isGear && (
                <Link href={`/rental?type=${type}`} className="block text-white font-bold text-xs md:text-base hover:text-brand-300 transition-colors">
                  Rental
                </Link>
              )}
              <Link href={`/catalogo?product_type=${type}`} className="block text-white font-bold text-xs md:text-base hover:text-brand-300 transition-colors">
                Marketplace
              </Link>
              <Link href="/vender" className="block text-white font-bold text-xs md:text-base hover:text-brand-300 transition-colors">
                Vender
              </Link>
              {hasAI && (
                <Link href={`/descubre?type=${type}`} className="flex items-center justify-center gap-1 md:gap-2 w-full bg-white text-gray-900 font-bold text-[9px] md:text-sm py-1 md:py-2.5 rounded md:rounded-lg hover:bg-brand-500 hover:text-white transition-colors">
                  <svg className="w-2.5 h-2.5 md:w-4 md:h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 00-.659 1.59v1.19a.75.75 0 01-.75.75h-6.24a.75.75 0 01-.75-.75v-1.19a2.25 2.25 0 00-.659-1.59L5 14.5m14 0V17a2 2 0 01-2 2H7a2 2 0 01-2-2v-2.5" />
                  </svg>
                  Descubre tu {type === 'esquis' ? 'esquí' : 'snowboard'} (IA)
                </Link>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
