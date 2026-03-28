'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { EASE_OUT_EXPO } from '@/lib/animations'

const CATEGORIES = [
  { key: 'esquis', label: 'Esquís' },
  { key: 'snowboards', label: 'Snowboards' },
  { key: 'botas_esqui', label: 'Botas Esquí' },
  { key: 'botas_snowboard', label: 'Botas Snow' },
  { key: 'cascos', label: 'Cascos' },
  { key: 'antiparras', label: 'Antiparras' },
  { key: 'parkas', label: 'Parkas' },
  { key: 'pantalones', label: 'Pantalones' },
  { key: 'fijaciones', label: 'Fijaciones' },
]

interface Props {
  isAdmin: boolean
}

export default function MobileMenu({ isAdmin }: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const sidebar = (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-[9998]"
            onClick={() => setOpen(false)}
          />

          {/* Sidebar — left side */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            className="fixed top-0 left-0 bottom-0 w-72 bg-white z-[9999] shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-[60px] border-b border-gray-100">
              <span className="font-body font-black text-lg">Menú</span>
              <button onClick={() => setOpen(false)} className="p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {isAdmin ? (
                <div className="space-y-1">
                  <Link href="/admin" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium hover:text-brand-500">
                    Panel de administración
                  </Link>
                  <form action="/auth/logout" method="POST">
                    <button type="submit" className="block py-3 text-sm font-medium hover:text-brand-500 w-full text-left">
                      Salir
                    </button>
                  </form>
                </div>
              ) : (
                <>
                  {/* Vender */}
                  <Link
                    href="/vender"
                    onClick={() => setOpen(false)}
                    className="pressable block w-full text-center bg-brand-500 text-white font-bold text-sm py-3 rounded-lg hover:bg-brand-600 transition-colors mb-5"
                  >
                    Vender
                  </Link>

                  {/* Categories */}
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Categorías</p>
                    <div className="space-y-0.5">
                      <Link href="/catalogo" onClick={() => setOpen(false)} className="block py-2 text-sm font-medium hover:text-brand-500">
                        Todo
                      </Link>
                      {CATEGORIES.map(cat => (
                        <Link
                          key={cat.key}
                          href={`/catalogo?product_type=${cat.key}`}
                          onClick={() => setOpen(false)}
                          className="block py-2 text-sm text-gray-600 font-bold hover:text-brand-500"
                        >
                          {cat.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="p-1"
        aria-label="Menú"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.svg
              key="arrow"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.2 }}
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </motion.svg>
          ) : (
            <motion.svg
              key="burger"
              initial={{ opacity: 0, rotate: 90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -90 }}
              transition={{ duration: 0.2 }}
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </motion.svg>
          )}
        </AnimatePresence>
      </button>

      {mounted && createPortal(sidebar, document.body)}
    </div>
  )
}
