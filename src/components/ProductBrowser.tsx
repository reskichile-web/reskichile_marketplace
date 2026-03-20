'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PRODUCT_TYPES, CONDITIONS, REGIONS } from '@/lib/constants'

interface Product {
  id: string
  product_type: string
  brand: string
  model: string | null
  price: number
  condition: string
  region: string
  product_images: { url: string; order: number }[]
}

type SortKey = 'recent' | 'price_asc' | 'price_desc' | 'name_asc'

interface Props {
  products: Product[]
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{title}</h4>
      <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
        {children}
      </div>
    </div>
  )
}

function CheckItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 py-0.5 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="rounded border-gray-300 text-brand-500 focus:ring-brand-500/30 w-3.5 h-3.5"
      />
      <span className={`text-sm ${checked ? 'text-brand-500 font-semibold' : 'text-gray-600 group-hover:text-gray-900'}`}>
        {label}
      </span>
    </label>
  )
}

export default function ProductBrowser({ products }: Props) {
  const [sort, setSort] = useState<SortKey>('recent')
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set())
  const [conditionFilters, setConditionFilters] = useState<Set<string>>(new Set())
  const [brandFilters, setBrandFilters] = useState<Set<string>>(new Set())
  const [regionFilters, setRegionFilters] = useState<Set<string>>(new Set())

  const brands = useMemo(() => {
    const set = new Set(products.map(p => p.brand))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [products])

  function toggleSet(set: Set<string>, value: string): Set<string> {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }

  const filtered = useMemo(() => {
    let result = [...products]

    if (typeFilters.size) result = result.filter(p => typeFilters.has(p.product_type))
    if (conditionFilters.size) result = result.filter(p => conditionFilters.has(p.condition))
    if (brandFilters.size) result = result.filter(p => brandFilters.has(p.brand))
    if (regionFilters.size) result = result.filter(p => regionFilters.has(p.region))

    if (sort === 'price_asc') result.sort((a, b) => a.price - b.price)
    else if (sort === 'price_desc') result.sort((a, b) => b.price - a.price)
    else if (sort === 'name_asc') result.sort((a, b) => a.brand.localeCompare(b.brand, 'es'))

    return result
  }, [products, sort, typeFilters, conditionFilters, brandFilters, regionFilters])

  const hasFilters = typeFilters.size > 0 || conditionFilters.size > 0 || brandFilters.size > 0 || regionFilters.size > 0

  function clearFilters() {
    setTypeFilters(new Set())
    setConditionFilters(new Set())
    setBrandFilters(new Set())
    setRegionFilters(new Set())
  }

  return (
    <section className="max-w-7xl mx-auto px-4">
      {/* Sticky sorting navbar */}
      <div className="sticky top-0 z-30 bg-white py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="font-body text-xl font-black">Productos</h2>
            <span className="text-sm text-gray-400">{filtered.length} resultados</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden sm:inline">Ordenar:</span>
            {([
              ['recent', 'Más recientes'],
              ['price_asc', 'Menor precio'],
              ['price_desc', 'Mayor precio'],
              ['name_asc', 'Marca A-Z'],
            ] as [SortKey, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${sort === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {label}
              </button>
            ))}
            <Link href="/vender" className="ml-8 px-8 py-2 rounded-lg text-sm font-bold bg-brand-500 text-white hover:bg-brand-600 transition-colors">
              Vender
            </Link>
          </div>
        </div>
      </div>

      {/* Main layout: filters sidebar + products */}
      <div className="flex gap-5 pt-6 pb-16">
        {/* Filters sidebar — left, sticky */}
        <aside className="hidden md:block w-48 shrink-0">
          <div className="sticky top-16 space-y-4 max-h-[calc(100vh-100px)] overflow-y-auto pr-1 pt-2">
            <FilterSection title="Tipo">
              {Object.entries(PRODUCT_TYPES).map(([v, l]) => (
                <CheckItem
                  key={v}
                  label={l}
                  checked={typeFilters.has(v)}
                  onChange={() => setTypeFilters(toggleSet(typeFilters, v))}
                />
              ))}
            </FilterSection>

            <FilterSection title="Marca">
              {brands.map(b => (
                <CheckItem
                  key={b}
                  label={b}
                  checked={brandFilters.has(b)}
                  onChange={() => setBrandFilters(toggleSet(brandFilters, b))}
                />
              ))}
            </FilterSection>

            <FilterSection title="Condición">
              {Object.entries(CONDITIONS).map(([v, l]) => (
                <CheckItem
                  key={v}
                  label={l}
                  checked={conditionFilters.has(v)}
                  onChange={() => setConditionFilters(toggleSet(conditionFilters, v))}
                />
              ))}
            </FilterSection>

            <FilterSection title="Región">
              {REGIONS.map(r => (
                <CheckItem
                  key={r}
                  label={r}
                  checked={regionFilters.has(r)}
                  onChange={() => setRegionFilters(toggleSet(regionFilters, r))}
                />
              ))}
            </FilterSection>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-red-500 hover:text-red-600 font-medium w-full text-left"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </aside>

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">No se encontraron productos</p>
              {hasFilters && (
                <button onClick={clearFilters} className="text-brand-500 text-sm mt-2 hover:underline">
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {filtered.map((product) => {
                const mainImage = product.product_images?.sort(
                  (a, b) => a.order - b.order
                )[0]
                const title = [product.brand, product.model].filter(Boolean).join(' ')

                return (
                  <Link key={product.id} href={`/producto/${product.id}`} className="group">
                    <div className="aspect-[4/5] bg-gray-100 overflow-hidden rounded-lg">
                      {mainImage ? (
                        <img
                          src={mainImage.url}
                          alt={title}
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="mt-3">
                      <p className="text-xs text-gray-400">{PRODUCT_TYPES[product.product_type]}</p>
                      <h3 className="font-body font-semibold text-sm truncate">{title}</h3>
                      <p className="font-body text-lg font-black text-brand-500 mt-0.5">
                        ${product.price.toLocaleString('es-CL')}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          <div className="text-center mt-12">
            <Link href="/catalogo" className="inline-block bg-brand-500 text-white px-8 py-3 rounded-sm font-medium hover:bg-brand-600 transition-colors text-sm">
              Ver catálogo completo
            </Link>
          </div>
        </div>

      </div>
    </section>
  )
}
