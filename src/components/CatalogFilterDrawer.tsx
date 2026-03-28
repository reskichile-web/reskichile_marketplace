'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useMotionValue, useTransform, useAnimation } from 'framer-motion'
import { EASE_OUT_EXPO } from '@/lib/animations'

interface Props {
  children: React.ReactNode
  hasFilters: boolean
}

export default function CatalogFilterDrawer({ children, hasFilters }: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const y = useMotionValue(0)
  const controls = useAnimation()
  const backdropOpacity = useTransform(y, [0, 400], [1, 0])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  function handleDragEnd(_: unknown, info: { offset: { y: number }; velocity: { y: number } }) {
    if (info.offset.y > 100 || info.velocity.y > 300) {
      controls.start({ y: '100%', transition: { duration: 0.2 } }).then(() => setOpen(false))
    } else {
      controls.start({ y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } })
    }
  }

  useEffect(() => {
    if (open) {
      y.set(0)
      controls.start({ y: 0 })
    }
  }, [open, y, controls])

  const drawer = (
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
            style={{ opacity: backdropOpacity }}
            onClick={() => setOpen(false)}
          />

          {/* Bottom sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={controls}
            exit={{ y: '100%' }}
            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            style={{ y }}
            className="fixed bottom-0 left-0 right-0 z-[9999] bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100">
              <span className="font-body font-black text-lg">Filtros</span>
              <button onClick={() => setOpen(false)} className="p-1 pressable">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 overscroll-contain" onClick={() => setOpen(false)}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return (
    <div className="md:hidden mb-4">
      <button
        onClick={() => setOpen(true)}
        className="pressable inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:border-gray-300 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        Filtros
        {hasFilters && <span className="w-2 h-2 rounded-full bg-brand-500" />}
      </button>
      {mounted && createPortal(drawer, document.body)}
    </div>
  )
}
