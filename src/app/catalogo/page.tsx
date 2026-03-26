export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import { StaggerGrid, StaggerItem } from '@/components/StaggerGrid'
import { PRODUCT_TYPES, CONDITIONS, REGIONS, ITEMS_PER_PAGE } from '@/lib/constants'

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

  const { data: products, count } = await query

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

  // Get all brands for filter
  const { data: allProducts } = await supabase
    .from('products')
    .select('brand')
    .eq('status', 'approved')

  const brands = Array.from(new Set(allProducts?.map(p => p.brand) || []))
    .sort((a, b) => a.localeCompare(b, 'es'))

  return (
    <div className="max-w-7xl mx-auto px-4 pt-6 md:pt-8 pb-24">
      {/* Sorting navbar */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-6">
        <div className="flex items-center gap-6">
          <h1 className="font-body text-2xl font-black">Catálogo</h1>
          {count !== null && count !== undefined && (
            <span className="text-sm text-gray-400">{count} productos</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 hidden sm:inline">Ordenar:</span>
          <div className="flex gap-1 text-sm font-nav font-semibold">
            <Link
              href={buildUrl({ sort: 'recent', page: '1' })}
              className={`px-3 py-1.5 rounded-sm transition-colors ${sort === 'recent' ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Recientes
            </Link>
            <Link
              href={buildUrl({ sort: 'price_asc', page: '1' })}
              className={`px-3 py-1.5 rounded-sm transition-colors ${sort === 'price_asc' ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Menor precio
            </Link>
            <Link
              href={buildUrl({ sort: 'price_desc', page: '1' })}
              className={`px-3 py-1.5 rounded-sm transition-colors ${sort === 'price_desc' ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Mayor precio
            </Link>
          </div>
        </div>
      </div>

      {/* Main layout: filters sidebar + product grid */}
      <div className="flex gap-8">
        {/* Filters sidebar — sticky with internal scroll */}
        <aside className="hidden md:block w-64 shrink-0">
          <div className="sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto pr-2">
            <form className="space-y-6">
              {/* Product type */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Tipo</h3>
                <div className="space-y-1.5">
                  <Link
                    href={buildUrl({ product_type: '', page: '1' })}
                    className={`block text-sm py-1 ${!searchParams.product_type ? 'text-brand-500 font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Todos
                  </Link>
                  {Object.entries(PRODUCT_TYPES).map(([v, l]) => (
                    <Link
                      key={v}
                      href={buildUrl({ product_type: v, page: '1' })}
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
                    href={buildUrl({ condition: '', page: '1' })}
                    className={`block text-sm py-1 ${!searchParams.condition ? 'text-brand-500 font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Todas
                  </Link>
                  {Object.entries(CONDITIONS).map(([v, l]) => (
                    <Link
                      key={v}
                      href={buildUrl({ condition: v, page: '1' })}
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
                    href={buildUrl({ brand: '', page: '1' })}
                    className={`block text-sm py-1 ${!searchParams.brand ? 'text-brand-500 font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Todas
                  </Link>
                  {brands.map(b => (
                    <Link
                      key={b}
                      href={buildUrl({ brand: b, page: '1' })}
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
                    href={buildUrl({ region: '', page: '1' })}
                    className={`block text-sm py-1 ${!searchParams.region ? 'text-brand-500 font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Todas
                  </Link>
                  {REGIONS.map(r => (
                    <Link
                      key={r}
                      href={buildUrl({ region: r, page: '1' })}
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
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">No se encontraron productos</p>
              {hasFilters && (
                <Link href="/catalogo" className="text-brand-500 text-sm mt-2 inline-block hover:underline">
                  Ver todos los productos
                </Link>
              )}
            </div>
          ) : (
            <>
              <StaggerGrid>
                {products.map((product) => {
                  const mainImage = product.product_images?.sort(
                    (a: { order: number }, b: { order: number }) => a.order - b.order
                  )[0]
                  const title = [product.brand, product.model].filter(Boolean).join(' ')

                  return (
                    <StaggerItem key={product.id}>
                    <Link
                      href={`/producto/${product.id}`}
                      className="group"
                    >
                      <div className="relative aspect-[4/5] bg-gray-100 overflow-hidden rounded-lg">
                        {mainImage ? (
                          <Image
                            src={mainImage.url}
                            alt={title}
                            fill
                            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
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
                    </StaggerItem>
                  )
                })}
              </StaggerGrid>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-16">
                  {page > 1 && (
                    <Link href={buildUrl({ page: String(page - 1) })} className="text-sm text-gray-500 hover:text-gray-900">
                      ← Anterior
                    </Link>
                  )}
                  <span className="text-sm text-gray-400">{page} / {totalPages}</span>
                  {page < totalPages && (
                    <Link href={buildUrl({ page: String(page + 1) })} className="text-sm text-gray-500 hover:text-gray-900">
                      Siguiente →
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
