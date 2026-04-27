'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import CatalogSidebar from './CatalogSidebar'

interface Props {
  selectedTypes: string[]
  selectedConditions: string[]
  selectedRegions: string[]
  typeCounts: Record<string, number>
  conditionCounts: Record<string, number>
  regionCounts: Record<string, number>
  totalCount: number
}

export default function CatalogMobileFilterButton(props: Props) {
  const [open, setOpen] = useState(false)
  const activeCount =
    props.selectedTypes.length + props.selectedConditions.length + props.selectedRegions.length

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Filtros"
        className="relative w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
      >
        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        {activeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-brand-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999]">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-sm bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <h3 className="font-body font-bold text-gray-900">Filtros</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <CatalogSidebar {...props} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
