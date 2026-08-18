export const revalidate = 30

import type { Metadata } from 'next'
import { createPublicServerClient } from '@/lib/supabase/server'
import CatalogSidebar from '@/components/CatalogSidebar'
import CatalogMobileFilterButton from '@/components/CatalogMobileFilterButton'
import CatalogSortSelect from '@/components/CatalogSortSelect'
import ProductCard from '@/components/ProductCard'
import ClaimListingsPrompt from '@/components/ClaimListingsPrompt'
import EmptyState from '@/components/illustrations/EmptyState'
import { PRODUCT_TYPES } from '@/lib/constants'
import { computeSkiCounts, passesSkiFilters } from '@/lib/ski-filters'

export const metadata: Metadata = {
  title: 'Catálogo - ReskiChile',
  description: 'Equipamiento de ski, snowboard y montaña usado en Chile',
}

interface Props {
  searchParams: Promise<{
    product_type?: string
    condition?: string
    region?: string
    brand?: string
    min_price?: string
    max_price?: string
    sort?: string
    tipo?: string
    genero?: string
    largo?: string
    ancho?: string
    fij?: string
    conexion?: string
  }>
}

export default async function CatalogPage({ searchParams }: Props) {
  const queryParams = await searchParams
  // Anonymous client (no cookies, no getUser round trip) — the catalog only
  // shows approved products, and login state is resolved client-side by
  // ClaimListingsPrompt. Note: this page is dynamic anyway (it reads searchParams).
  const supabase = createPublicServerClient()

  const types = (queryParams.product_type || '').split(',').filter(Boolean)
  const conditions = (queryParams.condition || '').split(',').filter(Boolean)
  const regions = (queryParams.region || '').split(',').filter(Boolean)
  const brands = (queryParams.brand || '').split(',').filter(Boolean)
  const minPrice = queryParams.min_price ? Number(queryParams.min_price) : undefined
  const maxPrice = queryParams.max_price ? Number(queryParams.max_price) : undefined
  const sort = queryParams.sort || 'recent'

  const tipo = (queryParams.tipo || '').split(',').filter(Boolean)
  const genero = (queryParams.genero || '').split(',').filter(Boolean)
  const largo = (queryParams.largo || '').split(',').filter(Boolean)
  const ancho = (queryParams.ancho || '').split(',').filter(Boolean)
  const fij = queryParams.fij || ''
  const conexion = (queryParams.conexion || '').split(',').filter(Boolean)

  let query = supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('status', 'approved')

  if (types.length) query = query.in('product_type', types)
  if (conditions.length) query = query.in('condition', conditions)
  if (regions.length) query = query.in('region', regions)
  if (brands.length) query = query.in('brand', brands)
  if (minPrice && !isNaN(minPrice)) query = query.gte('price', minPrice)
  if (maxPrice && !isNaN(maxPrice)) query = query.lte('price', maxPrice)

  if (sort === 'price_asc') query = query.order('price', { ascending: true })
  else if (sort === 'price_desc') query = query.order('price', { ascending: false })
  else query = query.order('created_at', { ascending: false })

  const [productsResult, countsResult] = await Promise.all([
    query,
    supabase
      .from('products')
      .select('product_type, condition, region, brand, attributes')
      .eq('status', 'approved'),
  ])

  let products = productsResult.data || []
  const allProducts = countsResult.data || []

  const conditionCounts: Record<string, number> = {}
  const regionCounts: Record<string, number> = {}
  const brandCounts: Record<string, number> = {}

  // Brand counts: scope to current product_type if set
  const brandScope = types.length
    ? allProducts.filter((p) => types.includes(p.product_type))
    : allProducts

  brandScope.forEach((p) => {
    if (p.brand) brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1
  })

  // Condition / region counts: from full approved set
  allProducts.forEach((p) => {
    if (p.condition) conditionCounts[p.condition] = (conditionCounts[p.condition] || 0) + 1
    if (p.region) regionCounts[p.region] = (regionCounts[p.region] || 0) + 1
  })

  const isEsquisOnly = types.length === 1 && types[0] === 'esquis'
  const skiCounts = computeSkiCounts(allProducts.filter((p) => p.product_type === 'esquis'))

  if (isEsquisOnly) {
    products = products.filter((p) =>
      passesSkiFilters(p.attributes as Record<string, unknown> | null, {
        tipo,
        genero,
        largo,
        ancho,
        fij,
        conexion,
      })
    )
  }

  const hasFilters =
    conditions.length > 0 ||
    regions.length > 0 ||
    brands.length > 0 ||
    minPrice != null ||
    maxPrice != null ||
    (isEsquisOnly &&
      (tipo.length > 0 ||
        genero.length > 0 ||
        largo.length > 0 ||
        ancho.length > 0 ||
        !!fij ||
        conexion.length > 0))

  const title =
    types.length === 1 && PRODUCT_TYPES[types[0]]
      ? PRODUCT_TYPES[types[0]]
      : 'Catálogo'

  return (
    <div className="max-w-[1600px] mx-auto px-5 md:px-10 pt-4 md:pt-6 pb-24">
      <div className="pt-2 md:pt-4 mb-8 md:mb-10">
        <h1 className="font-body font-black text-4xl md:text-5xl tracking-tight text-brand-400">{title}</h1>
        <p className="mt-2.5 max-w-2xl text-sm md:text-base text-gray-500 leading-relaxed">
          Equipo de montaña usado, directo de quien lo usó.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 mb-6 lg:hidden">
        <CatalogMobileFilterButton
          selectedConditions={conditions}
          selectedRegions={regions}
          selectedBrands={brands}
          selectedProductTypes={types}
          minPrice={minPrice}
          maxPrice={maxPrice}
          conditionCounts={conditionCounts}
          regionCounts={regionCounts}
          brandCounts={brandCounts}
          totalCount={allProducts.length}
          isEsquisOnly={isEsquisOnly}
          skiCounts={skiCounts}
          selectedTipo={tipo}
          selectedGenero={genero}
          selectedLargo={largo}
          selectedAncho={ancho}
          selectedFij={fij}
          selectedConexion={conexion}
        />
        <CatalogSortSelect value={sort} />
      </div>

      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-12">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <CatalogSidebar
              selectedConditions={conditions}
              selectedRegions={regions}
              selectedBrands={brands}
              minPrice={minPrice}
              maxPrice={maxPrice}
              conditionCounts={conditionCounts}
              regionCounts={regionCounts}
              brandCounts={brandCounts}
              isEsquisOnly={isEsquisOnly}
              skiCounts={skiCounts}
              selectedTipo={tipo}
              selectedGenero={genero}
              selectedLargo={largo}
              selectedAncho={ancho}
              selectedFij={fij}
              selectedConexion={conexion}
            />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="hidden lg:flex items-center justify-between mb-6">
            <p className="text-sm text-gray-500">
              {products.length} {products.length === 1 ? 'producto' : 'productos'}
            </p>
            <CatalogSortSelect value={sort} />
          </div>

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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
              {products.map((product) => {
                const sorted =
                  product.product_images?.sort(
                    (a: { order: number }, b: { order: number }) => a.order - b.order
                  ) || []
                const title = [product.brand, product.model].filter(Boolean).join(' ')

                let badge: string | undefined
                const attrs = product.attributes as Record<string, unknown> | null
                if (attrs) {
                  if (product.product_type === 'esquis' && attrs.ancho_mm != null) {
                    badge = `${attrs.ancho_mm}mm`
                  } else if (product.product_type === 'snowboards' && attrs.ancho != null) {
                    badge = String(attrs.ancho)
                  }
                }

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
                    badge={badge}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Claim-your-listings prompt — page footer, centered */}
      <div className="mt-10 md:mt-12 border-t border-gray-100 pt-6">
        <ClaimListingsPrompt />
      </div>
    </div>
  )
}
