'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function StickyHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false)
  const pathname = usePathname()

  // Don't hide on product pages or admin
  const alwaysVisible = pathname.startsWith('/producto/') || pathname.startsWith('/admin')
  // Catalog renders its own custom header — global one stays out
  const hiddenOnRoute = pathname.startsWith('/catalogo')

  useEffect(() => {
    if (alwaysVisible) {
      setHidden(false)
      return
    }

    function onScroll() {
      setHidden(window.scrollY > 100)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [alwaysVisible])

  if (hiddenOnRoute) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-out"
      style={{ transform: hidden ? 'translateY(-100%)' : 'translateY(0)' }}
    >
      {children}
    </div>
  )
}
