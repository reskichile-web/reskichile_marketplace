'use client'

import { useEffect, useRef, useState } from 'react'

export default function DescriptionCard({
  description,
  className = '',
  alwaysShowToggle = false,
}: {
  description: string
  className?: string
  alwaysShowToggle?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [canExpand, setCanExpand] = useState(false)
  const descriptionRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (expanded) return
    const element = descriptionRef.current
    if (!element) return

    const measure = () => {
      setCanExpand(element.scrollHeight > element.clientHeight + 1)
    }
    const frame = window.requestAnimationFrame(measure)
    const observer = new ResizeObserver(measure)
    observer.observe(element)

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [description, expanded])

  return (
    <section className={`overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.05)] ${className}`}>
      <header className="border-b border-gray-100 bg-gray-50/80 px-4 py-2">
        <h2 className="font-body text-xs font-bold text-gray-900">Descripción</h2>
      </header>
      <div className={`px-4 py-3.5 ${expanded ? '' : 'max-h-[124px] overflow-hidden'}`}>
        <p
          ref={descriptionRef}
          className={`whitespace-pre-wrap text-sm leading-6 text-gray-700 ${expanded ? '' : 'line-clamp-4'}`}
        >
          {description}
        </p>
      </div>
      {(canExpand || alwaysShowToggle) && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="w-full border-t border-gray-100 bg-gray-50/80 px-4 py-2 text-center font-body text-xs font-semibold text-gray-500 transition-colors hover:bg-gray-100"
          aria-expanded={expanded}
        >
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </section>
  )
}
