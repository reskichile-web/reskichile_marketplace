'use client'

import { useLayoutEffect, useRef } from 'react'
import styles from './AutomatedProductPost.module.css'

const MAXIMUM_FONT_SIZE = 76
const MINIMUM_FONT_SIZE = 34
const TWO_LINE_MAXIMUM_FONT_SIZE = 64

function renderedLines(title: HTMLElement): number {
  const range = document.createRange()
  range.selectNodeContents(title)
  const lineTops = new Set(
    [...range.getClientRects()]
      .filter(rect => rect.width > 0 && rect.height > 0)
      .map(rect => Math.round(rect.top)),
  )
  return Math.max(1, lineTops.size)
}

export default function FitTitle({ children }: { children: string }) {
  const titleRef = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    let cancelled = false
    const title = titleRef.current
    if (!title) return

    const fit = () => {
      if (cancelled) return
      title.style.whiteSpace = 'nowrap'
      title.style.fontSize = `${MAXIMUM_FONT_SIZE}px`
      const availableWidth = title.clientWidth
      const requiredWidth = title.scrollWidth

      if (requiredWidth <= availableWidth) {
        title.dataset.titleLines = '1'
        title.dataset.fitted = 'true'
        return
      }

      title.style.whiteSpace = 'normal'
      let minimum = MINIMUM_FONT_SIZE
      let maximum = TWO_LINE_MAXIMUM_FONT_SIZE
      let fittedSize = minimum

      for (let attempt = 0; attempt < 9; attempt += 1) {
        const candidate = (minimum + maximum) / 2
        title.style.fontSize = `${candidate}px`
        if (renderedLines(title) <= 2) {
          fittedSize = candidate
          minimum = candidate
        } else {
          maximum = candidate
        }
      }

      title.style.fontSize = `${Math.floor(fittedSize * 10) / 10}px`
      title.dataset.titleLines = String(renderedLines(title))
      title.dataset.fitted = 'true'
    }

    void document.fonts.ready.then(() => requestAnimationFrame(fit))
    const sizeObserver = new ResizeObserver(fit)
    if (title.parentElement) sizeObserver.observe(title.parentElement)
    window.addEventListener('resize', fit)
    return () => {
      cancelled = true
      sizeObserver.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [children])

  return (
    <h1 ref={titleRef} className={styles.title}>
      {children}
    </h1>
  )
}
