'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { track } from '@/lib/track'
import type { CategoryCardProps } from './CategoryCardAnimated'

const AI_CATEGORIES = new Set<string>([])

/**
 * Animation-free CategoryCard — same hover/tap reveal, driven by CSS transitions
 * instead of framer-motion. Used on slow / save-data connections so the home
 * never downloads the animation library.
 */
export default function CategoryCardStatic({ type, label, image, imagePosition, darkOverlay }: CategoryCardProps) {
  const [active, setActive] = useState(false)
  const hasAI = AI_CATEGORIES.has(type)
  const linkCount = 2 + (hasAI ? 1 : 0)
  const touchStart = useRef({ y: 0, time: 0 })
  const overlayBg = active ? 'rgba(0,0,0,0.75)' : darkOverlay ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)'

  return (
    <div
      className="relative block aspect-square overflow-hidden rounded-xl cursor-pointer"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onTouchStart={(e) => {
        touchStart.current = { y: e.touches[0].clientY, time: Date.now() }
      }}
      onTouchEnd={(e) => {
        const dy = Math.abs(e.changedTouches[0].clientY - touchStart.current.y)
        const dt = Date.now() - touchStart.current.time
        if (dy < 10 && dt < 300) {
          e.stopPropagation()
          setActive((prev) => !prev)
        }
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={label}
        loading="lazy"
        className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${active ? 'scale-110' : 'scale-100'} ${imagePosition || 'object-center'}`}
      />

      <div className="absolute inset-0 transition-colors duration-300" style={{ backgroundColor: overlayBg }} />

      <div className="relative h-full flex flex-col justify-end p-4 md:p-6">
        <div
          className="md:hidden transition-transform duration-300"
          style={{ transform: active ? `translateY(-${linkCount * 24 + 12}px)` : 'none' }}
        >
          <span className="font-body text-xl font-black text-white block">{label}</span>
        </div>
        <div
          className="hidden md:block transition-transform duration-300"
          style={{ transform: active ? `translateY(-${linkCount * 34 + 30}px)` : 'none' }}
        >
          <span className="font-body text-3xl font-black text-white block">{label}</span>
        </div>

        <div
          className={`absolute bottom-4 md:bottom-6 left-4 md:left-6 right-4 md:right-6 space-y-2 transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Link href={`/catalogo?product_type=${type}`} onClick={() => track({ type: 'click', name: 'category_marketplace', category: type })} className="block text-white font-bold text-xs md:text-base hover:text-brand-300 transition-colors">
            Marketplace
          </Link>
          <Link href="/vender" onClick={() => track({ type: 'click', name: 'category_vender', category: type })} className="block text-white font-bold text-xs md:text-base hover:text-brand-300 transition-colors">
            Vender
          </Link>
        </div>
      </div>
    </div>
  )
}
