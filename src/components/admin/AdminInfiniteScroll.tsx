'use client'

import { useEffect, useRef } from 'react'

interface Props {
  hasMore: boolean
  loading: boolean
  error?: string
  onLoadMore: () => void
  label?: string
}

export default function AdminInfiniteScroll({
  hasMore,
  loading,
  error = '',
  onLoadMore,
  label = 'Cargando más resultados',
}: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || loading || error || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) onLoadMore()
    }, { rootMargin: '600px 0px' })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [error, hasMore, loading, onLoadMore])

  if (!hasMore && !loading && !error) return null

  return (
    <div className="flex min-h-14 items-center justify-center py-4 text-center" aria-live="polite">
      {hasMore && <div ref={sentinelRef} className="h-px w-px" aria-hidden="true" />}
      {loading && (
        <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500" aria-hidden="true" />
          {label}
        </span>
      )}
      {error && (
        <button
          type="button"
          onClick={onLoadMore}
          className="text-xs font-bold text-brand-500 hover:text-brand-600"
        >
          Reintentar carga
        </button>
      )}
    </div>
  )
}
