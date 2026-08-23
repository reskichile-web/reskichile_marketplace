'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// The drawer (framer-motion) loads in its own chunk only after the first open,
// so framer-motion stays out of every page's initial bundle. The button below
// is plain SVG (no animation library) and renders instantly.
const MobileMenuDrawer = dynamic(() => import('./MobileMenuDrawer'), { ssr: false })

interface Props {
  isAdmin: boolean
  showSkiRacks: boolean
}

export default function MobileMenu({ isAdmin, showSkiRacks }: Props) {
  const [open, setOpen] = useState(false)
  const [everOpened, setEverOpened] = useState(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <div className="md:hidden">
      <button
        onClick={() => { setOpen(o => !o); setEverOpened(true) }}
        className="p-1"
        aria-label="Menú"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mounted after first open so the drawer chunk (framer-motion) only loads
          on demand; kept mounted afterward so enter/exit animations still play. */}
      {everOpened && (
        <MobileMenuDrawer
          open={open}
          isAdmin={isAdmin}
          showSkiRacks={showSkiRacks}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
