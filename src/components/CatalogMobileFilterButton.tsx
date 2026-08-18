'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronDown, X, SlidersHorizontal } from 'lucide-react'
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
  const [categoryOpen, setCategoryOpen] = useState(false)
  const categoryMenuRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    if (!categoryOpen) return

    function closeCategoryMenu(event: PointerEvent) {
      if (!categoryMenuRef.current?.contains(event.target as Node)) {
        setCategoryOpen(false)
      }
    }

    function closeCategoryMenuWithKeyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') setCategoryOpen(false)
    }

    document.addEventListener('pointerdown', closeCategoryMenu)
    document.addEventListener('keydown', closeCategoryMenuWithKeyboard)
    return () => {
      document.removeEventListener('pointerdown', closeCategoryMenu)
      document.removeEventListener('keydown', closeCategoryMenuWithKeyboard)
    }
  }, [categoryOpen])

  function changeCategory(value: string) {
    setCategory(value)
    setCategoryOpen(false)

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
            <div className="shrink-0 border-b border-gray-100 bg-white px-5 py-4">
              <p
                id="mobile-catalog-category-label"
                className="mb-2 block text-[11px] font-body font-bold uppercase tracking-[0.16em] text-brand-600"
              >
                Categoría
              </p>
              <div ref={categoryMenuRef} className="relative">
                <button
                  id="mobile-catalog-category"
                  type="button"
                  aria-labelledby="mobile-catalog-category-label mobile-catalog-category-value"
                  aria-haspopup="listbox"
                  aria-expanded={categoryOpen}
                  aria-controls="mobile-catalog-category-options"
                  onClick={() => setCategoryOpen(current => !current)}
                  className="flex h-12 w-full items-center justify-between rounded-xl border-2 border-brand-400 bg-white pl-4 pr-3 text-left font-body text-base font-bold text-gray-900 shadow-sm outline-none transition-colors hover:border-brand-500 focus:border-brand-600 focus:ring-2 focus:ring-brand-200"
                >
                  <span id="mobile-catalog-category-value" className="truncate">
                    {category ? PRODUCT_TYPES[category] : 'Todas las categorías'}
                  </span>
                  <ChevronDown
                    className={`ml-3 h-5 w-5 shrink-0 text-brand-500 transition-transform ${categoryOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>

                {categoryOpen && (
                  <div
                    id="mobile-catalog-category-options"
                    role="listbox"
                    aria-labelledby="mobile-catalog-category-label"
                    className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-[min(52vh,22rem)] overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white p-1.5 shadow-[0_18px_45px_rgba(15,23,42,0.18)]"
                  >
                    {[['', 'Todas las categorías'], ...Object.entries(PRODUCT_TYPES)].map(([value, label]) => {
                      const selected = category === value
                      return (
                        <button
                          key={value || 'all'}
                          type="button"
                          role="option"
                          data-category-value={value || 'all'}
                          aria-selected={selected}
                          onClick={() => changeCategory(value)}
                          className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left font-body text-[15px] transition-colors ${
                            selected
                              ? 'bg-brand-50 font-bold text-brand-600'
                              : 'font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-950'
                          }`}
                        >
                          <span>{label}</span>
                          {selected && <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />}
                        </button>
                      )
                    })}
                  </div>
                )}
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
