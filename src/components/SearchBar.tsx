'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q) {
      router.push(`/catalogo?brand=${encodeURIComponent(q)}`)
      setQuery('')
    } else {
      router.push('/catalogo')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
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
  )
}
