'use client'

import { useState, useEffect } from 'react'

export default function StickyHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    function onScroll() {
      setHidden(window.scrollY > 100)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-out"
      style={{ transform: hidden ? 'translateY(-100%)' : 'translateY(0)' }}
    >
      {children}
    </div>
  )
}
