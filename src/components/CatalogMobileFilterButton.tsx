'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, X, SlidersHorizontal } from 'lucide-react'
import CatalogSidebar from './CatalogSidebar'
import type { SkiCounts } from '@/lib/ski-filters'
import { PRODUCT_TYPES } from '@/lib/constants'

interface Props {
  selectedConditions: string[]
  selectedRegions: string[]
  selectedBrands: string[]
  selectedProductTypes: string[]
  minPrice?: number
  maxPrice?: number
  conditionCounts: Record<string, number>
  regionCounts: Record<string, number>
  brandCounts: Record<string, number>
  totalCount: number
  isEsquisOnly: boolean
  skiCounts: SkiCounts
  selectedTipo: string[]
  selectedGenero: string[]
  selectedLargo: string[]
  selectedAncho: string[]
  selectedFij: string
  selectedConexion: string[]
}

export default function CatalogMobileFilterButton(props: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const selectedCategory =
    props.selectedProductTypes.length === 1 ? props.selectedProductTypes[0] : ''
  const [category, setCategory] = useState(selectedCategory)
  const skiActive =
    props.isEsquisOnly &&
    (props.selectedTipo.length +
      props.selectedGenero.length +
      props.selectedLargo.length +
      props.selectedAncho.length +
      props.selectedConexion.length +
      (props.selectedFij ? 1 : 0))
  const activeCount =
    props.selectedConditions.length +
    props.selectedRegions.length +
    props.selectedBrands.length +
    (selectedCategory ? 1 : 0) +
    (props.minPrice != null || props.maxPrice != null ? 1 : 0) +
    (skiActive || 0)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    setCategory(selectedCategory)
  }, [selectedCategory])

  function changeCategory(value: string) {
    setCategory(value)

    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('product_type', value)
    else params.delete('product_type')

    // These filters only belong to Esquís and must not leak into another
    // category (or back into the general catalog).
    params.delete('tipo')
    params.delete('genero')
    params.delete('largo')
    params.delete('ancho')
    params.delete('fij')
    params.delete('conexion')
    params.delete('page')

    const query = params.toString()
    router.push(query ? `/catalogo?${query}` : '/catalogo')
  }

  const filterTitle = category && PRODUCT_TYPES[category]
    ? `Filtros para ${PRODUCT_TYPES[category]}`
    : 'Filtros generales'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-full text-sm font-body font-semibold text-gray-800 hover:border-black hover:text-black transition-colors"
      >
        <SlidersHorizontal className="w-4 h-4" />
        Filtros
        {activeCount > 0 && (
          <span className="bg-brand-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
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
            <div className="shrink-0 border-b border-brand-100 bg-brand-50/70 px-5 py-4">
              <label
                htmlFor="mobile-catalog-category"
                className="mb-2 block text-[11px] font-body font-bold uppercase tracking-[0.16em] text-brand-600"
              >
                Categoría
              </label>
              <div className="relative">
                <select
                  id="mobile-catalog-category"
                  value={category}
                  onChange={(event) => changeCategory(event.target.value)}
                  className="h-12 w-full appearance-none rounded-md border-2 border-brand-400 bg-white pl-4 pr-11 font-body text-base font-bold text-gray-900 shadow-sm outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-200"
                >
                  <option value="">Todas las categorías</option>
                  {Object.entries(PRODUCT_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-500"
                  aria-hidden="true"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <p className="mb-3 text-xs font-body font-bold uppercase tracking-widest text-gray-400">
                {filterTitle}
              </p>
              <CatalogSidebar
                selectedConditions={props.selectedConditions}
                selectedRegions={props.selectedRegions}
                selectedBrands={props.selectedBrands}
                minPrice={props.minPrice}
                maxPrice={props.maxPrice}
                conditionCounts={props.conditionCounts}
                regionCounts={props.regionCounts}
                brandCounts={props.brandCounts}
                isEsquisOnly={props.isEsquisOnly}
                skiCounts={props.skiCounts}
                selectedTipo={props.selectedTipo}
                selectedGenero={props.selectedGenero}
                selectedLargo={props.selectedLargo}
                selectedAncho={props.selectedAncho}
                selectedFij={props.selectedFij}
                selectedConexion={props.selectedConexion}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
