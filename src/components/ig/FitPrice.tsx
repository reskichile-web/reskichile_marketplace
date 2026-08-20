'use client'

import { useLayoutEffect, useRef } from 'react'
import styles from './AutomatedProductPost.module.css'

export default function FitPrice({ children }: { children: string }) {
  const priceRef = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    let cancelled = false
    const price = priceRef.current
    if (!price) return

    const fit = () => {
      if (cancelled) return
      price.style.fontSize = ''
      const maximumSize = Number.parseFloat(
        getComputedStyle(price).getPropertyValue('--price-font-size'),
      )
      price.style.fontSize = `${maximumSize}px`
      if (price.scrollWidth > price.clientWidth) {
        const fittedSize = maximumSize * price.clientWidth / price.scrollWidth
        price.style.fontSize = `${Math.floor(fittedSize * 10) / 10}px`
      }
      price.dataset.fitted = 'true'
    }

    void document.fonts.ready.then(() => requestAnimationFrame(fit))
    const sizeObserver = new ResizeObserver(fit)
    if (price.parentElement) sizeObserver.observe(price.parentElement)

    const poster = price.closest<HTMLElement>('[data-testid="ig-product-post"]')
    const shapeObserver = new MutationObserver(fit)
    if (poster) {
      shapeObserver.observe(poster, {
        attributes: true,
        attributeFilter: ['data-artwork-shape'],
      })
    }

    window.addEventListener('resize', fit)
    return () => {
      cancelled = true
      sizeObserver.disconnect()
      shapeObserver.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [children])

  return (
    <p ref={priceRef} className={styles.price}>
      {children}
    </p>
  )
}
