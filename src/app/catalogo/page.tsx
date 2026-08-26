export const revalidate = 30

import type { Metadata } from 'next'
import { createPublicServerClient } from '@/lib/supabase/server'
import CatalogSidebar from '@/components/CatalogSidebar'
import CatalogMobileFilterButton from '@/components/CatalogMobileFilterButton'
import CatalogSortSelect from '@/components/CatalogSortSelect'
import CatalogProductGrid from '@/components/CatalogProductGrid'
import ClaimListingsPrompt from '@/components/ClaimListingsPrompt'
import EmptyState from '@/components/illustrations/EmptyState'
import { PRODUCT_TYPES } from '@/lib/constants'
import { computeSkiCounts } from '@/lib/ski-filters'
import { computeBootCounts } from '@/lib/boot-filters'
import { hasCatalogAttributeFilters, parseCatalogFilters } from '@/lib/catalog'
import { fetchCatalogMetadata, fetchCatalogProductPage } from '@/lib/catalog-server'

export const metadata: Metadata = {
  title: 'Catálogo - ReskiChile',
  description: 'Equipamiento de ski, snowboard y montaña usado en Chile',
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined> & {
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
    boot_size?: string
    boot_flex?: string
    boot_boa?: string
  }>
}

export default async function CatalogPage({ searchParams }: Props) {
  const queryParams = await searchParams
  // Anonymous client (no cookies, no getUser round trip) — the catalog only
  // shows approved products, and login state is resolved client-side by
  // ClaimListingsPrompt. Note: this page is dynamic anyway (it reads searchParams).
  const supabase = createPublicServerClient()
  const filters = parseCatalogFilters(queryParams)
  const {
    types,
    conditions,
    regions,
    brands,
    minPrice,
    maxPrice,
    sort,
    tipo,
    genero,
    largo,
    ancho,
    fij,
    conexion,
    bootSize,
    bootFlex,
    bootBoa,
  } = filters

  const metadataPromise = fetchCatalogMetadata()
  const productPagePromise = hasCatalogAttributeFilters(filters)
    ? metadataPromise.then(metadata => fetchCatalogProductPage(supabase, filters, 0, metadata))
    : fetchCatalogProductPage(supabase, filters)
  const [allProducts, productPage] = await Promise.all([
    metadataPromise,
    productPagePromise,
  ])
  const products = productPage.products
  const totalCount = productPage.totalCount

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
  const isSkiBootsOnly = types.length === 1 && types[0] === 'botas_esqui'
  const isSnowboardBootsOnly = types.length === 1 && types[0] === 'botas_snowboard'
  const isBootsOnly = isSkiBootsOnly || isSnowboardBootsOnly
  const skiCounts = computeSkiCounts(allProducts.filter((p) => p.product_type === 'esquis'))
  const bootCounts = computeBootCounts(
    allProducts.filter((p) => p.product_type === types[0] && isBootsOnly)
  )

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
        conexion.length > 0)) ||
    (isBootsOnly &&
      (bootSize.length > 0 ||
        bootFlex.length > 0 ||
        genero.length > 0 ||
        !!bootBoa))

  const title =
    types.length === 1 && PRODUCT_TYPES[types[0]]
      ? PRODUCT_TYPES[types[0]]
      : 'Catálogo'

  const incrementalParams = new URLSearchParams()
  for (const [key, value] of Object.entries(queryParams)) {
    if (key !== 'offset' && typeof value === 'string') incrementalParams.set(key, value)
  }
  const incrementalQuery = incrementalParams.toString()

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
          isSkiBootsOnly={isSkiBootsOnly}
          isSnowboardBootsOnly={isSnowboardBootsOnly}
          bootCounts={bootCounts}
          selectedBootSize={bootSize}
          selectedBootFlex={bootFlex}
          selectedBootBoa={bootBoa}
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
              isSkiBootsOnly={isSkiBootsOnly}
              isSnowboardBootsOnly={isSnowboardBootsOnly}
              bootCounts={bootCounts}
              selectedBootSize={bootSize}
              selectedBootFlex={bootFlex}
              selectedBootBoa={bootBoa}
            />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="hidden lg:flex items-center justify-between mb-6">
            <p className="text-sm text-gray-500">
              {totalCount} {totalCount === 1 ? 'producto' : 'productos'}
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
            <CatalogProductGrid
              key={incrementalQuery || 'all-products'}
              initialProducts={products}
              totalCount={totalCount}
              queryString={incrementalQuery}
            />
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
