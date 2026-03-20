'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

export default function SearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus()
    }
  }, [expanded])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q) {
      router.push(`/catalogo?brand=${encodeURIComponent(q)}`)
      setQuery('')
      setExpanded(false)
    } else {
      router.push('/catalogo')
    }
  }

  return (
    <>
      {/* Desktop: always visible input */}
      <form onSubmit={handleSubmit} className="hidden md:block w-full">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar marca, modelo..."
            className="w-full bg-gray-100 border-0 rounded-full pl-10 pr-4 py-2.5 text-sm font-nav focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:bg-white transition-colors"
          />
        </div>
      </form>

      {/* Mobile: icon trigger */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="md:hidden p-1.5 text-gray-600"
        aria-label="Buscar"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      {/* Mobile: expanded search bar — portaled */}
      {mounted && expanded && createPortal(
        <>
          <div className="fixed inset-0 z-[9996]" onClick={() => { setExpanded(false); setQuery('') }} />
          <div className="fixed top-[60px] left-0 right-0 z-[9997] bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
            <form onSubmit={handleSubmit}>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar marca, modelo..."
                  className="w-full bg-gray-100 border-0 rounded-full pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => { setExpanded(false); setQuery('') }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
