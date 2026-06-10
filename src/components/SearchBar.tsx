'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_TYPES, CONDITIONS, PRODUCT_ATTRIBUTES } from '@/lib/constants'

interface SearchResult {
  id: string
  slug: string | null
  brand: string | null
  model: string | null
  product_type: string
  condition: string
  price: number
  region: string
  attributes: Record<string, unknown> | null
  image_url: string | null
  rank: number
}

// Key attributes worth surfacing on a result card (max 2), with labels
// from PRODUCT_ATTRIBUTES.
function attributeSummary(r: SearchResult): string {
  const attrs = r.attributes
  if (!attrs) return ''
  const defs = PRODUCT_ATTRIBUTES[r.product_type] || []
  const parts: string[] = []
  for (const def of defs) {
    const value = attrs[def.key]
    if (value === undefined || value === null || value === '' || typeof value === 'boolean') continue
    parts.push(`${def.label}: ${String(value)}`)
    if (parts.length === 2) break
  }
  return parts.join(' · ')
}

export default function SearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [approximate, setApproximate] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestId = useRef(0)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (expanded && inputRef.current) inputRef.current.focus()
  }, [expanded])

  // Debounced live search. Strict first (every word must match); if that
  // returns nothing, fall back to relaxed so the user always sees the
  // closest available products.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setOpen(false)
      setSearching(false)
      return
    }
    setSearching(true)
    const id = ++requestId.current
    const timer = setTimeout(async () => {
      const supabase = createClient()
      let approx = false
      let { data } = await supabase.rpc('search_products', { q, max_results: 8, relaxed: false })
      if (!data || data.length === 0) {
        const fallback = await supabase.rpc('search_products', { q, max_results: 8, relaxed: true })
        data = fallback.data
        approx = true
      }
      if (id !== requestId.current) return // stale response
      setResults((data as SearchResult[]) || [])
      setApproximate(approx && !!data?.length)
      setOpen(true)
      setActiveIndex(-1)
      setSearching(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const close = useCallback(() => {
    setOpen(false)
    setExpanded(false)
    setQuery('')
    setResults([])
    setActiveIndex(-1)
  }, [])

  function go(r: SearchResult) {
    router.push(`/producto/${r.slug || r.id}`)
    close()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) {
      if (e.key === 'Escape') close()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(results[activeIndex >= 0 ? activeIndex : 0])
    } else if (e.key === 'Escape') {
      close()
    }
  }

  const resultsPanel = (
    <div className="bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
      {results.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-gray-500">Sin resultados para «{query.trim()}»</p>
          <Link href="/catalogo" onClick={close} className="inline-block mt-2 text-xs text-brand-500 hover:underline">
            Explorar el catálogo completo
          </Link>
        </div>
      ) : (
        <>
          {approximate && (
            <p className="px-4 pt-2.5 pb-1 text-[11px] text-gray-400">
              No hay coincidencias exactas — esto es lo más parecido:
            </p>
          )}
          <ul className="max-h-[60vh] overflow-y-auto divide-y divide-gray-50">
            {results.map((r, i) => {
              const title = [r.brand, r.model].filter(Boolean).join(' ') || 'Sin título'
              const attrLine = attributeSummary(r)
              return (
                <li key={r.id}>
                  <button
                    onClick={() => go(r)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${i === activeIndex ? 'bg-brand-50' : ''}`}
                  >
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                      {r.image_url ? (
                        <Image
                          src={r.image_url}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {PRODUCT_TYPES[r.product_type] || r.product_type}
                        {' · '}{CONDITIONS[r.condition] || r.condition}
                        {' · '}{r.region}
                      </p>
                      {attrLine && <p className="text-[11px] text-gray-400 truncate">{attrLine}</p>}
                    </div>
                    <span className="font-body text-sm font-bold text-brand-500 shrink-0">
                      ${r.price.toLocaleString('es-CL')}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <Link
            href="/catalogo"
            onClick={close}
            className="block px-4 py-2.5 text-center text-xs font-medium text-brand-500 hover:bg-brand-50 border-t border-gray-100 transition-colors"
          >
            Ver catálogo completo
          </Link>
        </>
      )}
    </div>
  )

  const searchIcon = searching ? (
    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
  ) : (
    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )

  return (
    <>
      {/* Desktop: always-visible input + dropdown */}
      <div className="hidden md:block w-full relative">
        <div className="relative">
          {searchIcon}
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (results.length || query.trim().length >= 2) setOpen(true) }}
            placeholder="Buscar marca, modelo, talla, tipo..."
            className="w-full bg-gray-100 border-0 rounded-full pl-10 pr-4 py-2.5 text-sm font-nav focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:bg-white transition-colors"
          />
        </div>
        {open && query.trim().length >= 2 && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute top-full left-0 right-0 mt-2 z-50">
              {resultsPanel}
            </div>
          </>
        )}
      </div>

      {/* Mobile: icon trigger */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="md:hidden p-1 text-gray-900 hover:text-brand-500 transition-colors"
        aria-label="Buscar"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      {/* Mobile: expanded search + results — portaled */}
      {mounted && expanded && createPortal(
        <>
          <div className="fixed inset-0 z-[9996] bg-black/20" onClick={close} />
          <div className="fixed top-[60px] left-0 right-0 z-[9997] bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
            <div className="relative">
              {searchIcon}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar marca, modelo, talla, tipo..."
                className="w-full bg-gray-100 border-0 rounded-full pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:bg-white"
              />
              <button
                type="button"
                onClick={close}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {open && query.trim().length >= 2 && (
              <div className="mt-2">
                {resultsPanel}
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  )
}
