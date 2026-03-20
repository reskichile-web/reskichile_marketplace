'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  type: string
  label: string
  count: number
  image: string
  products: { id: string; brand: string; model: string | null; price: number }[]
}

export default function CategoryCard({ type, label, count, image, products }: Props) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={`/catalogo?product_type=${type}`}
      className="relative block aspect-square overflow-hidden rounded-xl"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image with zoom */}
      <motion.img
        src={image}
        alt={label}
        className="absolute inset-0 w-full h-full object-cover"
        animate={{ scale: hovered ? 1.1 : 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        loading="lazy"
      />

      {/* Overlay — darker on hover */}
      <motion.div
        className="absolute inset-0"
        animate={{ backgroundColor: hovered ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.35)' }}
        transition={{ duration: 0.3 }}
      />

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end p-6">
        {/* Title + count — slides up on hover */}
        <motion.div
          animate={{ y: hovered ? -100 : 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="font-body text-2xl md:text-3xl font-black text-white block">
            {label}
          </span>
          <span className="text-sm text-white/70 mt-1 block">{count} productos</span>
        </motion.div>

        {/* Products list — appears on hover */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="absolute bottom-6 left-6 right-6"
            >
              {products.length > 0 ? (
                <div className="space-y-1">
                  {products.slice(0, 3).map(p => (
                    <div
                      key={p.id}
                      className="flex justify-between items-center text-sm text-white/80"
                    >
                      <span className="truncate pr-3">{[p.brand, p.model].filter(Boolean).join(' ')}</span>
                      <span className="shrink-0 font-bold text-white">${p.price.toLocaleString('es-CL')}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <span className="block mt-2 text-xs font-bold text-white/60">
                Ver todos →
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Link>
  )
}
