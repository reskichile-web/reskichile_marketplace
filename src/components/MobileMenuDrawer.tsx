'use client'

import { createPortal } from 'react-dom'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { EASE_OUT_EXPO } from '@/lib/animations'
import SellTagIcon from './SellTagIcon'

const CATEGORIES = [
  { key: 'racks', label: 'Racks', href: '/ski-rack' },
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

export default function MobileMenuDrawer({
  open,
  isAdmin,
  showSkiRacks,
  onClose,
}: {
  open: boolean
  isAdmin: boolean
  showSkiRacks: boolean
  onClose: () => void
}) {
  const sidebar = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9998] bg-black/40"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            className="fixed bottom-0 left-0 top-0 z-[9999] flex w-72 flex-col bg-white shadow-2xl"
          >
            <div className="flex h-[60px] items-center justify-between border-b border-gray-100 px-5">
              <span className="font-body text-lg font-black">Menú</span>
              <button onClick={onClose} className="p-1" aria-label="Cerrar menú">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={onClose}
                  className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-gray-800"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#F5B800" stroke="none" aria-hidden="true">
                    <path d="M12 1L9 7l-7 1 5 5-1.5 7L12 17l6.5 3L17 13l5-5-7-1z" />
                  </svg>
                  Dashboard admin
                </Link>
              )}

              <div className="mb-5">
                <p className="mb-2 font-nav text-sm font-light text-gray-500">
                  ¿Tienes equipo que quieras vender?
                </p>
                <Link
                  href="/vender"
                  onClick={onClose}
                  className="pressable inline-flex w-full items-center justify-center gap-2 bg-brand-500 py-3 text-center font-nav text-sm font-bold tracking-wide text-white transition-colors hover:bg-brand-600"
                >
                  <SellTagIcon className="h-4 w-4" />
                  PUBLICAR
                </Link>
              </div>

              <nav className="border-t border-gray-100 pt-4" aria-label="Categorías de equipamiento">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Categorías</p>
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                  <Link
                    href="/catalogo"
                    onClick={onClose}
                    className="group flex min-h-12 items-center justify-between px-4 py-3 font-nav text-base font-bold text-gray-900 transition-colors hover:bg-brand-50 hover:text-brand-600"
                  >
                    <span>Todo</span>
                    <ChevronRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-brand-400" strokeWidth={1.5} aria-hidden="true" />
                  </Link>
                  {CATEGORIES.filter(category => showSkiRacks || category.key !== 'racks').map((category) => (
                    <Link
                      key={category.key}
                      href={category.href || `/catalogo?product_type=${category.key}`}
                      onClick={onClose}
                      className="group flex min-h-12 items-center justify-between px-4 py-3 font-nav text-base font-light text-gray-700 transition-colors hover:bg-brand-50 hover:text-brand-600"
                    >
                      <span className="flex items-center gap-2.5">
                        {category.label}
                        {category.key === 'racks' && (
                          <span className="rounded-sm bg-brand-400 px-1.5 py-0.5 font-body text-[8px] font-bold uppercase leading-none tracking-wider text-white">
                            Nuevo
                          </span>
                        )}
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-brand-400" strokeWidth={1.5} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </nav>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return createPortal(sidebar, document.body)
}
