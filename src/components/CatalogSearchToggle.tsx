'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'

export default function CatalogSearchToggle({ defaultValue }: { defaultValue?: string }) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buscar"
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors shrink-0"
        >
          <Search className="w-5 h-5 text-gray-700" />
        </button>
      </div>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setOpen(false)}
          />
          <form
            action="/catalogo"
            method="GET"
            className="absolute inset-x-0 -top-2 -bottom-2 z-[9999] flex items-center gap-2 bg-white rounded-xl shadow-xl border border-gray-100 px-3"
          >
            <input
              ref={inputRef}
              name="brand"
              type="text"
              defaultValue={defaultValue}
              placeholder="Marca, modelo..."
              className="flex-1 min-w-0 bg-gray-100 border-0 rounded-full px-4 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:bg-white transition-colors"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors shrink-0"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </form>
        </>
      )}
    </>
  )
}
