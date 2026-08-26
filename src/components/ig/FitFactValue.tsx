'use client'

import { Fragment, useLayoutEffect, useRef } from 'react'
import styles from './AutomatedProductPost.module.css'

interface FitFactValueProps {
  children: string
  emphasized?: boolean
}

export default function FitFactValue({ children, emphasized = false }: FitFactValueProps) {
  const valueRef = useRef<HTMLSpanElement>(null)
  const words = children.trim().split(/\s+/).filter(Boolean)

  useLayoutEffect(() => {
    let cancelled = false
    const value = valueRef.current
    if (!value) return

    const fit = () => {
      if (cancelled) return
      value.style.fontSize = ''

      const availableWidth = value.clientWidth
      const maximumSize = Number.parseFloat(getComputedStyle(value).fontSize)
      const wordWidths = [...value.querySelectorAll<HTMLElement>('[data-ig-fact-word]')]
        .map((word) => word.getBoundingClientRect().width)
      const widestWord = Math.max(0, ...wordWidths)

      if (availableWidth > 0 && widestWord > availableWidth) {
        const fittedSize = maximumSize * availableWidth / widestWord
        value.style.fontSize = `${Math.max(1, Math.floor(fittedSize * 10) / 10)}px`
      }
      value.dataset.fitted = 'true'
    }

    void document.fonts.ready.then(() => requestAnimationFrame(fit))
    const sizeObserver = new ResizeObserver(fit)
    if (value.parentElement) sizeObserver.observe(value.parentElement)
    window.addEventListener('resize', fit)
    return () => {
      cancelled = true
      sizeObserver.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [children])

  return (
    <span
      ref={valueRef}
      className={`${styles.factValue} ${emphasized ? styles.factValueEmphasized : ''}`}
      data-ig-fact-value
    >
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          {index > 0 ? ' ' : null}
          <span className={styles.factWord} data-ig-fact-word>{word}</span>
        </Fragment>
      ))}
    </span>
  )
}
