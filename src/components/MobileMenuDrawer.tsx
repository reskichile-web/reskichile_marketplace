'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { EASE_OUT_EXPO } from '@/lib/animations'
import SellTagIcon from './SellTagIcon'

type AccordionName = 'marketplace' | 'installation' | 'support' | null

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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  )
}

export default function MobileMenuDrawer({
  open,
  isAdmin,
  onClose,
}: {
  open: boolean
  isAdmin: boolean
  onClose: () => void
}) {
  const [expanded, setExpanded] = useState<AccordionName>(null)
  const pathname = usePathname()
  const isSkiRackRoute = pathname.startsWith('/ski-rack') || pathname === '/carrito'

  function toggle(name: Exclude<AccordionName, null>) {
    setExpanded((current) => current === name ? null : name)
  }

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

              <Link
                href="/vender"
                onClick={onClose}
                className="pressable mb-5 inline-flex w-full items-center justify-center gap-2 rounded-none bg-brand-500 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-brand-600"
              >
                <SellTagIcon className="h-4 w-4" />
                Vender
              </Link>

              {isSkiRackRoute ? (
              <nav className="border-t border-gray-100 pt-3" aria-label="Navegación Ski Rack">
                <div className="border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => toggle('marketplace')}
                    className="flex w-full items-center justify-between py-3.5 text-left text-sm font-bold text-gray-800"
                    aria-expanded={expanded === 'marketplace'}
                  >
                    Marketplace
                    <Chevron open={expanded === 'marketplace'} />
                  </button>
                  <div className={`grid transition-[grid-template-rows] duration-200 ${expanded === 'marketplace' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="grid grid-cols-2 overflow-hidden pb-3">
                      {CATEGORIES.filter((category) => category.key !== 'racks').map((category) => (
                        <Link
                          key={category.key}
                          href={category.href || `/catalogo?product_type=${category.key}`}
                          onClick={onClose}
                          className="px-2 py-2 text-xs font-medium text-gray-600 hover:text-brand-500"
                        >
                          {category.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                <Link href="/ski-rack" onClick={onClose} className="flex items-center justify-between border-b border-gray-100 py-3.5 text-sm font-bold text-gray-800 hover:text-brand-500">
                  Catálogo
                  <span aria-hidden="true">→</span>
                </Link>

                <Link href="/carrito" onClick={onClose} className="flex items-center justify-between border-b border-gray-100 py-3.5 text-sm font-bold text-gray-800 hover:text-brand-500">
                  Carrito
                  <span aria-hidden="true">→</span>
                </Link>

                <div className="border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => toggle('installation')}
                    className="flex w-full items-center justify-between py-3.5 text-left text-sm font-bold text-gray-800"
                    aria-expanded={expanded === 'installation'}
                  >
                    Instalación
                    <Chevron open={expanded === 'installation'} />
                  </button>
                  <div className={`grid transition-[grid-template-rows] duration-200 ${expanded === 'installation' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <Link href="/ski-rack#instructivo" onClick={onClose} className="flex items-center gap-3 px-2 py-3 text-sm text-gray-600 hover:text-brand-500">
                        <svg className="h-5 w-5 text-brand-500" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 5.25A2.25 2.25 0 016.75 3h10.5a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0117.25 21H6.75a2.25 2.25 0 01-2.25-2.25V5.25zM8 7.5h8M8 11h8M8 14.5h5" />
                        </svg>
                        Instructivo
                      </Link>
                      <Link href="/ski-rack#video" onClick={onClose} className="flex items-center gap-3 px-2 pb-4 pt-2 text-sm text-gray-600 hover:text-brand-500">
                        <svg className="h-5 w-5 text-brand-500" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="12" cy="12" r="9" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="m10 8.75 5 3.25-5 3.25v-6.5z" />
                        </svg>
                        Video demostración
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => toggle('support')}
                    className="flex w-full items-center justify-between py-3.5 text-left text-sm font-bold text-gray-800"
                    aria-expanded={expanded === 'support'}
                  >
                    Soporte
                    <Chevron open={expanded === 'support'} />
                  </button>
                  <div className={`grid transition-[grid-template-rows] duration-200 ${expanded === 'support' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <Link href="mailto:reskichile@gmail.com?subject=Contacto%20ReskiChile" onClick={onClose} className="flex items-center gap-3 px-2 py-3 text-sm text-gray-600 hover:text-brand-500">
                        <svg className="h-5 w-5 text-brand-500" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75A2.25 2.25 0 016 4.5h12a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0118 19.5H6a2.25 2.25 0 01-2.25-2.25V6.75z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 7.5 6.08 4.05a2.55 2.55 0 002.84 0L19.5 7.5" />
                        </svg>
                        Contacto
                      </Link>
                      <Link href="mailto:reskichile@gmail.com?subject=Solicitud%20de%20devoluci%C3%B3n" onClick={onClose} className="flex items-center gap-3 px-2 pb-4 pt-2 text-sm text-gray-600 hover:text-brand-500">
                        <svg className="h-5 w-5 text-brand-500" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7H5v-4M5.35 6.65A8.5 8.5 0 112.9 13" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 11h6v6H9z" />
                        </svg>
                        Devolución
                      </Link>
                    </div>
                  </div>
                </div>
              </nav>
              ) : (
                <nav className="border-t border-gray-100 pt-4" aria-label="Categorías de equipamiento">
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Categorías</p>
                  <div className="space-y-0.5">
                    <Link href="/catalogo" onClick={onClose} className="block py-2 text-sm font-medium hover:text-brand-500">
                      Todo
                    </Link>
                    {CATEGORIES.map((category) => (
                      <Link
                        key={category.key}
                        href={category.href || `/catalogo?product_type=${category.key}`}
                        onClick={onClose}
                        className={`relative flex items-center text-sm font-bold text-gray-600 hover:text-brand-500 ${category.key === 'racks' ? 'pb-2 pt-4' : 'py-2'}`}
                      >
                        {category.label}
                        {category.key === 'racks' && (
                          <span className="absolute -top-0.5 left-0 rounded-sm bg-brand-400 px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none tracking-wider text-white">
                            Nuevo
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </nav>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return createPortal(sidebar, document.body)
}
