'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ProductCard from '@/components/ProductCard'
import type { CatalogProduct } from '@/lib/catalog'

interface CatalogPageResponse {
  products: CatalogProduct[]
  totalCount: number
  nextOffset: number
  hasMore: boolean
  error?: string
}

interface Props {
  initialProducts: CatalogProduct[]
  totalCount: number
  queryString: string
}

function productBadge(product: CatalogProduct): string | undefined {
  const attributes = product.attributes
  if (!attributes) return undefined

  if (product.product_type === 'esquis' && attributes.ancho_mm != null) {
    return `${attributes.ancho_mm}mm`
  }
  if (product.product_type === 'snowboards' && attributes.ancho != null) {
    return String(attributes.ancho)
  }
  return undefined
}

export default function CatalogProductGrid({ initialProducts, totalCount, queryString }: Props) {
  const [products, setProducts] = useState(initialProducts)
  const [nextOffset, setNextOffset] = useState(initialProducts.length)
  const [hasMore, setHasMore] = useState(initialProducts.length < totalCount)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)
  const requestRef = useRef<AbortController | null>(null)

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return

    loadingRef.current = true
    setLoading(true)
    setError('')
    const controller = new AbortController()
    requestRef.current = controller

    try {
      const params = new URLSearchParams(queryString)
      params.set('offset', String(nextOffset))
      const response = await fetch(`/api/catalog/products?${params.toString()}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
      const data = await response.json() as CatalogPageResponse
      if (!response.ok || !Array.isArray(data.products)) {
        throw new Error(data.error || 'No pudimos cargar más productos.')
      }

      setProducts(current => {
        const knownIds = new Set(current.map(product => product.id))
        return [...current, ...data.products.filter(product => !knownIds.has(product.id))]
      })
      setNextOffset(data.nextOffset)
      setHasMore(data.hasMore)
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setError(loadError instanceof Error ? loadError.message : 'No pudimos cargar más productos.')
    } finally {
      if (!controller.signal.aborted) {
        loadingRef.current = false
        setLoading(false)
      }
    }
  }, [hasMore, nextOffset, queryString])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || error || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadMore()
    }, { rootMargin: '700px 0px' })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [error, hasMore, loadMore])

  useEffect(() => () => requestRef.current?.abort(), [])

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product, index) => {
          const sortedImages = [...(product.product_images || [])]
            .sort((a, b) => a.order - b.order)
          const title = [product.brand, product.model].filter(Boolean).join(' ')

          return (
            <ProductCard
              key={product.id}
              id={product.id}
              slug={product.slug}
              title={title}
              brand={product.brand}
              productType={product.product_type}
              price={product.price}
              mainImageUrl={sortedImages[0]?.url}
              secondImageUrl={sortedImages[1]?.url}
              badge={productBadge(product)}
              priority={index < 4}
            />
          )
        })}
      </div>

      {hasMore && <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />}

      <div className="mt-8 min-h-10 text-center" aria-live="polite">
        {loading && (
          <span className="inline-flex items-center gap-2 text-sm text-gray-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500" aria-hidden="true" />
            Cargando más productos
          </span>
        )}
        {error && (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="text-sm font-semibold text-brand-500 hover:text-brand-600"
          >
            Reintentar carga
          </button>
        )}
      </div>
    </>
  )
}
