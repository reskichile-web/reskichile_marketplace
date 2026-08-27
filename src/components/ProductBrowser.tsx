'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpDown, ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import SellTagIcon from '@/components/SellTagIcon'
import { StaggerGrid, StaggerItem } from '@/components/StaggerGrid'
import ProductCard from '@/components/ProductCard'
import { PRODUCT_TYPES, CONDITIONS, REGIONS } from '@/lib/constants'
import EmptyState from '@/components/illustrations/EmptyState'

interface Product {
  id: string
  slug?: string | null
  product_type: string
  brand: string
  model: string | null
  price: number
  condition: string
  region: string
  product_images: { url: string; order: number }[]
}

type SortKey = 'recent' | 'price_asc' | 'price_desc' | 'name_asc'

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Más recientes',
  price_asc: 'Precio: menor a mayor',
  price_desc: 'Precio: mayor a menor',
  name_asc: 'Marca A-Z',
}

interface Props {
  products: Product[]
  recentProductIds?: string[]
}

function FilterSection({
  title,
  active,
  defaultOpen = false,
  children,
}: {
  title: string
  active: boolean
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-t border-gray-200">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="flex w-full items-center justify-between py-4 text-left"
        aria-expanded={open}
      >
        <span className={`text-xs font-body font-bold uppercase tracking-widest ${active ? 'text-black' : 'text-gray-700'}`}>
          {title}
          {active && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-brand-500 align-middle" />}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && <div className="space-y-2 pb-5 pr-1">{children}</div>}
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

function MobileFilterSection({
  title,
  active,
  defaultOpen = false,
  children,
}: {
  title: string
  active: boolean
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-t border-gray-200">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <span className={`text-xs font-body font-bold uppercase tracking-widest ${active ? 'text-black' : 'text-gray-700'}`}>
          {title}
          {active && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-brand-500 align-middle" />}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && <div className="max-h-64 space-y-2 overflow-y-auto pb-5 pr-1">{children}</div>}
    </div>
  )
}

function MobileCheckItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded-sm border-gray-300 text-black focus:ring-black/20"
      />
      <span className={`flex-1 truncate text-sm ${checked ? 'font-medium text-black' : 'text-gray-600 group-hover:text-black'}`}>
        {label}
      </span>
    </label>
  )
}

export default function ProductBrowser({ products, recentProductIds = [] }: Props) {
  const [sort, setSort] = useState<SortKey>('recent')
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set())
  const [conditionFilters, setConditionFilters] = useState<Set<string>>(new Set())
  const [brandFilters, setBrandFilters] = useState<Set<string>>(new Set())
  const [regionFilters, setRegionFilters] = useState<Set<string>>(new Set())
  const recentBadgePositions = useMemo(
    () => new Map(recentProductIds.map((id, index) => [id, index])),
    [recentProductIds],
  )

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
  const activeFilterCount = typeFilters.size + conditionFilters.size + brandFilters.size + regionFilters.size
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = mobileFiltersOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileFiltersOpen])

  function clearFilters() {
    setTypeFilters(new Set())
    setConditionFilters(new Set())
    setBrandFilters(new Set())
    setRegionFilters(new Set())
  }

  const filterContent = (
    <>
      <FilterSection title="Tipo" active={typeFilters.size > 0} defaultOpen>
        {Object.entries(PRODUCT_TYPES).map(([v, l]) => (
          <CheckItem
            key={v}
            label={l}
            checked={typeFilters.has(v)}
            onChange={() => setTypeFilters(toggleSet(typeFilters, v))}
          />
        ))}
      </FilterSection>
      <FilterSection title="Marca" active={brandFilters.size > 0}>
        {brands.map(b => (
          <CheckItem
            key={b}
            label={b}
            checked={brandFilters.has(b)}
            onChange={() => setBrandFilters(toggleSet(brandFilters, b))}
          />
        ))}
      </FilterSection>
      <FilterSection title="Condición" active={conditionFilters.size > 0}>
        {Object.entries(CONDITIONS).map(([v, l]) => (
          <CheckItem
            key={v}
            label={l}
            checked={conditionFilters.has(v)}
            onChange={() => setConditionFilters(toggleSet(conditionFilters, v))}
          />
        ))}
      </FilterSection>
      <FilterSection title="Región" active={regionFilters.size > 0}>
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
    </>
  )

  const mobileFilterContent = (
    <>
      <MobileFilterSection title="Tipo" active={typeFilters.size > 0} defaultOpen>
        {Object.entries(PRODUCT_TYPES).map(([value, label]) => (
          <MobileCheckItem
            key={value}
            label={label}
            checked={typeFilters.has(value)}
            onChange={() => setTypeFilters(toggleSet(typeFilters, value))}
          />
        ))}
      </MobileFilterSection>
      <MobileFilterSection title="Marca" active={brandFilters.size > 0}>
        {brands.map(brand => (
          <MobileCheckItem
            key={brand}
            label={brand}
            checked={brandFilters.has(brand)}
            onChange={() => setBrandFilters(toggleSet(brandFilters, brand))}
          />
        ))}
      </MobileFilterSection>
      <MobileFilterSection title="Condición" active={conditionFilters.size > 0}>
        {Object.entries(CONDITIONS).map(([value, label]) => (
          <MobileCheckItem
            key={value}
            label={label}
            checked={conditionFilters.has(value)}
            onChange={() => setConditionFilters(toggleSet(conditionFilters, value))}
          />
        ))}
      </MobileFilterSection>
      <MobileFilterSection title="Región" active={regionFilters.size > 0}>
        {REGIONS.map(region => (
          <MobileCheckItem
            key={region}
            label={region}
            checked={regionFilters.has(region)}
            onChange={() => setRegionFilters(toggleSet(regionFilters, region))}
          />
        ))}
      </MobileFilterSection>
      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="mt-4 text-xs font-body uppercase tracking-wider text-gray-500 transition-colors hover:text-black"
        >
          Limpiar filtros
        </button>
      )}
    </>
  )

  return (
    <section className="max-w-7xl mx-auto px-4">
      {/* Sticky sorting navbar */}
      <div data-testid="landing-product-toolbar" className="sticky top-0 z-30 bg-white">
        <div className="flex items-center gap-3 py-3 lg:hidden">
          <h2 className="font-body text-lg font-black">Productos</h2>
          <span className="text-sm text-gray-400">{filtered.length}</span>
        </div>

        <div className="flex items-center justify-between gap-3 border-y border-gray-200 py-3 lg:hidden">
          <button
            type="button"
            data-testid="landing-filter-button"
            onClick={() => setMobileFiltersOpen(true)}
            className="relative inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-body font-semibold text-gray-800 transition-colors hover:border-black hover:text-black"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          <label className="relative inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <ArrowUpDown className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={1.6} aria-hidden="true" />
            <span className="whitespace-nowrap font-body font-medium text-gray-700">{SORT_LABELS[sort]}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.5} aria-hidden="true" />
            <select
              aria-label="Ordenar productos"
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            >
              <option value="recent">Más recientes</option>
              <option value="price_asc">Precio: menor a mayor</option>
              <option value="price_desc">Precio: mayor a menor</option>
              <option value="name_asc">Marca A-Z</option>
            </select>
          </label>
        </div>

        <div className="hidden items-center justify-between gap-3 border-y border-gray-200 py-4 lg:flex">
          <div className="flex items-center gap-3">
            <h2 className="font-body text-xl font-black">Productos</h2>
            <span className="text-sm text-gray-400">{filtered.length}</span>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <label className="relative flex h-9 min-w-48 items-center gap-3">
              <ArrowUpDown
                className="h-4 w-4 shrink-0 text-gray-400"
                strokeWidth={1.6}
                aria-hidden="true"
              />
              <span className="sr-only">Ordenar productos</span>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                className="h-9 min-w-40 cursor-pointer appearance-none border-0 bg-transparent py-0 pl-0 pr-8 font-body text-base font-medium text-gray-700 outline-none focus:ring-0"
              >
                <option value="recent">Más recientes</option>
                <option value="price_asc">Menor precio</option>
                <option value="price_desc">Mayor precio</option>
                <option value="name_asc">Marca A-Z</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </label>
            <Link
              href="/vender"
              className="pressable ml-8 hidden h-9 items-center justify-center gap-1.5 bg-brand-500 px-5 text-sm font-bold text-white transition-colors hover:bg-brand-600 font-nav md:inline-flex"
            >
              <SellTagIcon className="h-4 w-4" />
              Vender
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-[9999] lg:hidden">
          <div className="filter-overlay-enter absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
          <div data-testid="landing-filter-drawer" className="filter-drawer-enter absolute inset-y-0 left-0 flex w-72 max-w-[calc(100vw-2rem)] flex-col bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="font-body font-bold text-gray-900">Filtros</h3>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Cerrar"
                className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-600" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <p className="mb-3 text-xs font-body font-bold uppercase tracking-widest text-gray-400">
                Filtros generales
              </p>
              {mobileFilterContent}
            </div>
          </div>
        </div>
      )}

      {/* Main layout: filters sidebar + products */}
      <div className="flex gap-5 pt-6 pb-16">
        {/* Filters sidebar — desktop accordions expand with their full content. */}
        <aside className="hidden lg:block w-48 shrink-0">
          <div className="sticky top-16 pr-1 pt-2">
            {filterContent}
          </div>
        </aside>

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          {filtered.length === 0 ? (
            <div>
              <EmptyState
                title="No se encontraron productos"
                description={hasFilters ? 'Intenta ajustar los filtros.' : undefined}
              />
              {hasFilters && (
                <div className="text-center -mt-8">
                  <button onClick={clearFilters} className="text-brand-500 text-sm hover:underline">
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>
          ) : (
            <StaggerGrid>
              {filtered.map((product) => {
                const sorted = product.product_images?.sort(
                  (a, b) => a.order - b.order
                ) || []
                const title = [product.brand, product.model].filter(Boolean).join(' ')

                return (
                  <StaggerItem key={product.id}>
                    <ProductCard
                      id={product.id}
                      slug={product.slug}
                      title={title}
                      brand={product.brand}
                      productType={product.product_type}
                      price={product.price}
                      mainImageUrl={sorted[0]?.url}
                      secondImageUrl={sorted[1]?.url}
                      recentlyPublished={recentBadgePositions.has(product.id)}
                      recentBadgeIndex={recentBadgePositions.get(product.id)}
                      sealed={product.condition === 'nuevo_sellado'}
                      trackClickAs="product_card"
                    />
                  </StaggerItem>
                )
              })}
            </StaggerGrid>
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
