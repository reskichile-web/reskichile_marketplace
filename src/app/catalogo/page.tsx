export const revalidate = 30

import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import CatalogHeader from '@/components/CatalogHeader'
import CatalogSidebar from '@/components/CatalogSidebar'
import CatalogMobileFilterButton from '@/components/CatalogMobileFilterButton'
import CatalogSearchToggle from '@/components/CatalogSearchToggle'
import CatalogSortSelect from '@/components/CatalogSortSelect'
import ProductCard from '@/components/ProductCard'
import EmptyState from '@/components/illustrations/EmptyState'

export const metadata: Metadata = {
  title: 'Catalogo - ReskiChile',
  description: 'Equipamiento de ski, snowboard y montana usado en Chile',
}

interface Props {
  searchParams: {
    product_type?: string
    condition?: string
    region?: string
    brand?: string
    sort?: string
  }
}

export default async function CatalogPage({ searchParams }: Props) {
  const supabase = createServerSupabaseClient()

  const types = (searchParams.product_type || '').split(',').filter(Boolean)
  const conditions = (searchParams.condition || '').split(',').filter(Boolean)
  const regions = (searchParams.region || '').split(',').filter(Boolean)
  const brand = searchParams.brand || ''
  const sort = searchParams.sort || 'recent'

  let query = supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('status', 'approved')

  if (types.length) query = query.in('product_type', types)
  if (conditions.length) query = query.in('condition', conditions)
  if (regions.length) query = query.in('region', regions)
  if (brand) query = query.ilike('brand', `%${brand}%`)

  if (sort === 'price_asc') query = query.order('price', { ascending: true })
  else if (sort === 'price_desc') query = query.order('price', { ascending: false })
  else query = query.order('created_at', { ascending: false })

  const [productsResult, countsResult] = await Promise.all([
    query,
    supabase.from('products').select('product_type, condition, region').eq('status', 'approved'),
  ])

  const products = productsResult.data || []
  const allProducts = countsResult.data || []

  // Compute counts per filter category
  const typeCounts: Record<string, number> = {}
  const conditionCounts: Record<string, number> = {}
  const regionCounts: Record<string, number> = {}
  allProducts.forEach((p) => {
    if (p.product_type) typeCounts[p.product_type] = (typeCounts[p.product_type] || 0) + 1
    if (p.condition) conditionCounts[p.condition] = (conditionCounts[p.condition] || 0) + 1
    if (p.region) regionCounts[p.region] = (regionCounts[p.region] || 0) + 1
  })

  const hasFilters = types.length > 0 || conditions.length > 0 || regions.length > 0 || !!brand

  return (
    <div className="-mt-[95px] md:-mt-[131px] pb-24">
      {/* Banner */}
      <section className="relative aspect-[3/1] md:aspect-auto md:h-[420px] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1612997038509-31033c9d17c5?w=7680&q=95&auto=format&fit=crop"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-[center_60%] md:object-[center_95%]"
        />
        <div className="absolute inset-0 bg-black/15" />

        {/* Header pegado arriba */}
        <div className="absolute top-0 inset-x-0 md:inset-x-8 z-30">
          <div className="max-w-7xl mx-auto">
            <CatalogHeader
              mobileMenu={
                <CatalogMobileFilterButton
                  selectedTypes={types}
                  selectedConditions={conditions}
                  selectedRegions={regions}
                  typeCounts={typeCounts}
                  conditionCounts={conditionCounts}
                  regionCounts={regionCounts}
                  totalCount={allProducts.length}
                />
              }
            />
          </div>
        </div>

        {/* Watermark — bottom + horizontally mirrored above */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pointer-events-none">
          <span
            className="font-body font-extrabold italic text-[20vw] text-white/30 leading-[0.78] tracking-[-0.05em] whitespace-nowrap select-none mb-[2vw] md:mb-[0.4vw]"
            style={{ transform: 'scaleX(-1) translateY(8px)' }}
          >
            RESKICHILE
          </span>
          <h1 className="font-body font-extrabold italic text-[20vw] text-white/30 leading-[0.78] tracking-[-0.05em] whitespace-nowrap select-none">
            RESKICHILE
          </h1>
        </div>
      </section>

      {/* Content */}
      <div className="relative -mt-6 md:-mt-24 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm min-h-[600px] p-5 md:p-10">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6 mb-6 md:mb-8">
              <h2 className="font-body font-bold text-black text-lg md:text-2xl">
                Encuentra tu próximo equipo.
              </h2>
              <div className="relative flex items-center justify-between gap-3">
                <CatalogSortSelect value={sort} />
                {/* Mobile: search icon that expands as overlay */}
                <div className="md:hidden">
                  <CatalogSearchToggle defaultValue={brand} />
                </div>
                {/* Desktop: full search input */}
                <form action="/catalogo" method="GET" className="hidden md:flex items-center gap-3 md:min-w-[300px]">
                  <label htmlFor="catalog-search" className="text-sm font-body font-medium text-gray-700 shrink-0">
                    Buscar:
                  </label>
                  <input
                    id="catalog-search"
                    name="brand"
                    type="text"
                    defaultValue={brand}
                    placeholder="Marca, Modelo, ..."
                    className="flex-1 bg-gray-100 border-0 rounded-full px-4 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:bg-white transition-colors"
                  />
                </form>
              </div>
            </div>

            {/* Main layout: sidebar + grid */}
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Sidebar — left, desktop only */}
              <aside className="hidden lg:block w-72 shrink-0 lg:order-first">
                <div className="lg:sticky lg:top-24">
                  <CatalogSidebar
                    selectedTypes={types}
                    selectedConditions={conditions}
                    selectedRegions={regions}
                    typeCounts={typeCounts}
                    conditionCounts={conditionCounts}
                    regionCounts={regionCounts}
                    totalCount={allProducts.length}
                  />
                </div>
              </aside>

              {/* Products grid (3x2) */}
              <div className="flex-1 min-w-0">
                {products.length === 0 ? (
                  <EmptyState
                    title="No encontramos productos"
                    description={
                      hasFilters
                        ? 'Intenta ajustar los filtros o buscar otra cosa.'
                        : 'Aún no hay productos publicados.'
                    }
                    actionLabel={hasFilters ? 'Limpiar filtros' : 'Publicar producto'}
                    actionHref={hasFilters ? '/catalogo' : '/vender'}
                  />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                    {products.map((product) => {
                      const sorted =
                        product.product_images?.sort(
                          (a: { order: number }, b: { order: number }) => a.order - b.order
                        ) || []
                      const title = [product.brand, product.model].filter(Boolean).join(' ')
                      return (
                        <ProductCard
                          key={product.id}
                          id={product.id}
                          slug={product.slug}
                          title={title}
                          productType={product.product_type}
                          price={product.price}
                          mainImageUrl={sorted[0]?.url}
                          secondImageUrl={sorted[1]?.url}
                        />
                      )
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
