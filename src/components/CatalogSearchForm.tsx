'use client'

import { FormEvent, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function CatalogSearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextQuery = query.replace(/\s+/g, ' ').trim()
    router.push(nextQuery ? `/catalogo?q=${encodeURIComponent(nextQuery)}` : '/catalogo')
  }

  function clearSearch() {
    setQuery('')
    router.push('/catalogo')
  }

  return (
    <form onSubmit={submit} role="search" className="relative w-full lg:max-w-xl">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Busca marca, modelo, equipo, talla..."
        aria-label="Buscar en el catálogo"
        className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-12 pr-28 font-body text-sm text-gray-900 shadow-sm outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
      />
      {query && (
        <button
          type="button"
          onClick={clearSearch}
          aria-label="Limpiar búsqueda"
          className="absolute right-[91px] top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      <button
        type="submit"
        className="absolute right-1.5 top-1/2 h-9 -translate-y-1/2 rounded-lg bg-brand-500 px-5 font-nav text-xs font-bold text-white transition hover:bg-brand-600"
      >
        Buscar
      </button>
    </form>
  )
}
