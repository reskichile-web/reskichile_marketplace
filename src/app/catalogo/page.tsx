export const revalidate = 30

import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { StaggerGrid, StaggerItem } from '@/components/StaggerGrid'
import CatalogFilterDrawer from '@/components/CatalogFilterDrawer'
import ProductCard from '@/components/ProductCard'
import { PRODUCT_TYPES, CONDITIONS, REGIONS, ITEMS_PER_PAGE } from '@/lib/constants'
import EmptyState from '@/components/illustrations/EmptyState'

interface Props {
  searchParams: {
    product_type?: string
    condition?: string
    brand?: string
    region?: string
    min_price?: string
    max_price?: string
    page?: string
    sort?: string
  }
}

export function generateMetadata({ searchParams }: Props): Metadata {
  const type = searchParams.product_type
  const typeName = type ? PRODUCT_TYPES[type] : null

  const title = typeName
    ? `${typeName} en venta - ReskiChile`
    : 'Catalogo - ReskiChile'

  const description = typeName
    ? `Encuentra ${typeName.toLowerCase()} usados al mejor precio en ReskiChile`
    : 'Equipamiento de ski, snowboard y montaña usado en Chile'

  return { title, description }
}

export default async function CatalogPage({ searchParams }: Props) {
  const supabase = createServerSupabaseClient()

  const page = parseInt(searchParams.page || '1')
  const offset = (page - 1) * ITEMS_PER_PAGE
  const sort = searchParams.sort || 'recent'

  let query = supabase
    .from('products')
    .select('*, product_images(*)', { count: 'exact' })
    .eq('status', 'approved')
    .range(offset, offset + ITEMS_PER_PAGE - 1)

  // Sorting
  if (sort === 'price_asc') query = query.order('price', { ascending: true })
  else if (sort === 'price_desc') query = query.order('price', { ascending: false })
  else query = query.order('created_at', { ascending: false })

  if (searchParams.product_type) query = query.eq('product_type', searchParams.product_type)
  if (searchParams.condition) query = query.eq('condition', searchParams.condition)
  if (searchParams.brand) query = query.ilike('brand', `%${searchParams.brand}%`)
  if (searchParams.region) query = query.eq('region', searchParams.region)
  if (searchParams.min_price) query = query.gte('price', parseInt(searchParams.min_price))
  if (searchParams.max_price) query = query.lte('price', parseInt(searchParams.max_price))

  // Run both queries in parallel instead of sequentially
  const [productsResult, brandsResult] = await Promise.all([
    query,
    supabase.from('products').select('brand').eq('status', 'approved'),
  ])

  const { data: products, count } = productsResult
  const { data: allProducts } = brandsResult

  const totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE)
  const hasFilters = Object.entries(searchParams).some(([k, v]) => v && k !== 'page' && k !== 'sort')

  function buildUrl(params: Record<string, string>) {
    const merged = { ...searchParams, ...params }
    const sp = new URLSearchParams()
    Object.entries(merged).forEach(([k, v]) => {
      if (v) sp.set(k, v)
    })
    return `/catalogo?${sp.toString()}`
  }

  const brands = Array.from(new Set(allProducts?.map(p => p.brand) || []))
    .sort((a, b) => a.localeCompare(b, 'es'))

  const activeTypeName = searchParams.product_type ? PRODUCT_TYPES[searchParams.product_type] : null

  return (
    <div className="pb-24">
      {/* ─── Banner ─── */}
      <div className="relative -mt-[95px] md:-mt-[131px] h-[220px] md:h-[320px] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1551524559-8af4e6624178?w=1920&q=80&fit=crop&crop=center"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex items-center justify-center pt-[95px] md:pt-[131px]">
          <h1 className="font-display text-[80px] md:text-[140px] lg:text-[180px] text-white/20 leading-none tracking-tight select-none">
            RESKI
          </h1>
        </div>
      </div>

      {/* ─── Content container — overlaps banner ─── */}
      <div className="relative -mt-10 md:-mt-14">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-white rounded-t-2xl shadow-sm">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-5 md:px-8 py-4 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <h2 className="font-body text-lg md:text-xl font-black text-gray-900">
                  {activeTypeName || 'Catalogo'}
                </h2>
                {count !== null && count !== undefined && (
                  <span className="text-sm text-gray-400">{count} productos</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Sort — desktop pills */}
                <div className="hidden md:flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 mr-1">Ordenar:</span>
                  {([
                    ['recent', 'Recientes'],
                    ['price_asc', 'Menor precio'],
                    ['price_desc', 'Mayor precio'],
                  ] as const).map(([key, label]) => (
                    <Link
                      key={key}
                      prefetch={false}
                      href={buildUrl({ sort: key, page: '1' })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${sort === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
                {/* Sort — mobile select */}
                <select
                  defaultValue={sort}
                  onChange={() => {}}
                  className="md:hidden appearance-none bg-gray-100 text-gray-700 text-xs font-medium pl-2.5 pr-6 py-1.5 rounded-full border-0"
                >
                  <option value="recent">Recientes</option>
                  <option value="price_asc">Menor precio</option>
                  <option value="price_desc">Mayor precio</option>
                </select>
              </div>
            </div>

      {/* Mobile filter drawer */}
      <div className="px-5 pt-3">
      <CatalogFilterDrawer hasFilters={hasFilters}>
        <form className="space-y-6">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Tipo</h3>
            <div className="space-y-1.5">
              <Link prefetch={false} href={buildUrl({ product_type: '', page: '1' })} className={`block text-sm py-1 ${!searchParams.product_type ? 'text-brand-500 font-bold' : 'text-gray-600'}`}>Todos</Link>
              {Object.entries(PRODUCT_TYPES).map(([v, l]) => (
                <Link key={v} prefetch={false} href={buildUrl({ product_type: v, page: '1' })} className={`block text-sm py-1 ${searchParams.product_type === v ? 'text-brand-500 font-bold' : 'text-gray-600'}`}>{l}</Link>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Condición</h3>
            <div className="space-y-1.5">
              <Link prefetch={false} href={buildUrl({ condition: '', page: '1' })} className={`block text-sm py-1 ${!searchParams.condition ? 'text-brand-500 font-bold' : 'text-gray-600'}`}>Todas</Link>
              {Object.entries(CONDITIONS).map(([v, l]) => (
                <Link key={v} prefetch={false} href={buildUrl({ condition: v, page: '1' })} className={`block text-sm py-1 ${searchParams.condition === v ? 'text-brand-500 font-bold' : 'text-gray-600'}`}>{l}</Link>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Región</h3>
            <div className="space-y-1.5">
              <Link prefetch={false} href={buildUrl({ region: '', page: '1' })} className={`block text-sm py-1 ${!searchParams.region ? 'text-brand-500 font-bold' : 'text-gray-600'}`}>Todas</Link>
              {REGIONS.map(r => (
                <Link key={r} prefetch={false} href={buildUrl({ region: r, page: '1' })} className={`block text-sm py-1 ${searchParams.region === r ? 'text-brand-500 font-bold' : 'text-gray-600'}`}>{r}</Link>
              ))}
            </div>
          </div>
          {hasFilters && (
            <Link href="/catalogo" className="block text-sm text-center text-red-500 font-medium pt-2">Limpiar filtros</Link>
          )}
        </form>
      </CatalogFilterDrawer>
      </div>

      {/* Main layout: filters sidebar + product grid */}
      <div className="flex gap-6 px-5 md:px-8 pt-4 pb-8">
        {/* Filters sidebar — sticky with internal scroll */}
        <aside className="hidden md:block w-52 shrink-0">
          <div className="sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto pr-2">
            <form className="space-y-6">
              {/* Product type */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Tipo</h3>
                <div className="space-y-1.5">
                  <Link
                    prefetch={false} href={buildUrl({ product_type: '', page: '1' })}
                    className={`block text-sm py-1 ${!searchParams.product_type ? 'text-brand-500 font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Todos
                  </Link>
                  {Object.entries(PRODUCT_TYPES).map(([v, l]) => (
                    <Link
                      key={v}
                      prefetch={false} href={buildUrl({ product_type: v, page: '1' })}
                      className={`block text-sm py-1 ${searchParams.product_type === v ? 'text-brand-500 font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      {l}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Condition */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Condición</h3>
                <div className="space-y-1.5">
                  <Link
                    prefetch={false} href={buildUrl({ condition: '', page: '1' })}
                    className={`block text-sm py-1 ${!searchParams.condition ? 'text-brand-500 font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Todas
                  </Link>
                  {Object.entries(CONDITIONS).map(([v, l]) => (
                    <Link
                      key={v}
                      prefetch={false} href={buildUrl({ condition: v, page: '1' })}
                      className={`block text-sm py-1 ${searchParams.condition === v ? 'text-brand-500 font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      {l}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Brand */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Marca</h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  <Link
                    prefetch={false} href={buildUrl({ brand: '', page: '1' })}
                    className={`block text-sm py-1 ${!searchParams.brand ? 'text-brand-500 font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Todas
                  </Link>
                  {brands.map(b => (
                    <Link
                      key={b}
                      prefetch={false} href={buildUrl({ brand: b, page: '1' })}
                      className={`block text-sm py-1 truncate ${searchParams.brand === b ? 'text-brand-500 font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      {b}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Region */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Región</h3>
                <div className="space-y-1.5">
                  <Link
                    prefetch={false} href={buildUrl({ region: '', page: '1' })}
                    className={`block text-sm py-1 ${!searchParams.region ? 'text-brand-500 font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Todas
                  </Link>
                  {REGIONS.map(r => (
                    <Link
                      key={r}
                      prefetch={false} href={buildUrl({ region: r, page: '1' })}
                      className={`block text-sm py-1 ${searchParams.region === r ? 'text-brand-500 font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      {r}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Price range */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Precio</h3>
                <div className="flex gap-2">
                  <input
                    name="min_price"
                    type="number"
                    defaultValue={searchParams.min_price || ''}
                    placeholder="Mín"
                    className="w-full border border-gray-200 rounded-sm px-2 py-1.5 text-sm"
                  />
                  <input
                    name="max_price"
                    type="number"
                    defaultValue={searchParams.max_price || ''}
                    placeholder="Máx"
                    className="w-full border border-gray-200 rounded-sm px-2 py-1.5 text-sm"
                  />
                </div>
                <button type="submit" className="mt-2 w-full bg-brand-500 text-white px-4 py-1.5 rounded-sm text-sm font-medium hover:bg-brand-600 transition-colors">
                  Aplicar precio
                </button>
              </div>

              {/* Clear filters */}
              {hasFilters && (
                <Link
                  href="/catalogo"
                  className="block text-sm text-center text-red-500 hover:text-red-600 font-medium pt-2"
                >
                  Limpiar todos los filtros
                </Link>
              )}
            </form>
          </div>
        </aside>

        {/* Product grid — takes remaining width */}
        <div className="flex-1 min-w-0">
          {!products || products.length === 0 ? (
            <EmptyState
              title="No encontramos productos"
              description={hasFilters ? 'Intenta ajustar los filtros o busca otra cosa.' : 'Aun no hay productos publicados.'}
              actionLabel={hasFilters ? 'Limpiar filtros' : 'Publicar producto'}
              actionHref={hasFilters ? '/catalogo' : '/vender'}
            />
          ) : (
            <>
              <StaggerGrid>
                {products.map((product) => {
                  const sorted = product.product_images?.sort(
                    (a: { order: number }, b: { order: number }) => a.order - b.order
                  ) || []
                  const title = [product.brand, product.model].filter(Boolean).join(' ')

                  return (
                    <StaggerItem key={product.id}>
                      <ProductCard
                        id={product.id}
                        slug={product.slug}
                        title={title}
                        productType={product.product_type}
                        price={product.price}
                        mainImageUrl={sorted[0]?.url}
                        secondImageUrl={sorted[1]?.url}
                      />
                    </StaggerItem>
                  )
                })}
              </StaggerGrid>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-16">
                  {page > 1 && (
                    <Link prefetch={false} href={buildUrl({ page: String(page - 1) })} className="text-sm text-gray-500 hover:text-gray-900">
                      ← Anterior
                    </Link>
                  )}
                  <span className="text-sm text-gray-400">{page} / {totalPages}</span>
                  {page < totalPages && (
                    <Link prefetch={false} href={buildUrl({ page: String(page + 1) })} className="text-sm text-gray-500 hover:text-gray-900">
                      Siguiente →
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
          </div>{/* /bg-white */}
        </div>{/* /max-w */}
      </div>{/* /overlap */}
    </div>
  )
}
