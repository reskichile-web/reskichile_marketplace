'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

function NavigationProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  // Start progress when clicking internal links
  const handleClick = useCallback((e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('a')
    if (!target) return
    const href = target.getAttribute('href')
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return
    if (target.getAttribute('target') === '_blank') return
    if (e.metaKey || e.ctrlKey || e.shiftKey) return

    // Same page — don't show progress
    const url = new URL(href, window.location.origin)
    if (url.pathname === pathname && url.search === window.location.search) return

    setVisible(true)
    setTransitioning(true)
    setProgress(20)

    // Simulate progress
    const t1 = setTimeout(() => setProgress(45), 100)
    const t2 = setTimeout(() => setProgress(65), 300)
    const t3 = setTimeout(() => setProgress(80), 600)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [pathname])

  useEffect(() => {
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [handleClick])

  // Complete progress when route changes
  useEffect(() => {
    if (!transitioning) return
    setProgress(100)
    const timer = setTimeout(() => {
      setVisible(false)
      setTransitioning(false)
      setProgress(0)
    }, 200)
    return () => clearTimeout(timer)
  }, [pathname, searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] h-[2px]">
      <div
        className="h-full bg-brand-500 transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? '150ms' : '400ms',
        }}
      />
    </div>
  )
}

// Wrap in Suspense because useSearchParams needs it
export default function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBar />
    </Suspense>
  )
}
