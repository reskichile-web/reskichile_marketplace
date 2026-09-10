import 'server-only'

import { unstable_cache } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CATALOG_PAGE_SIZE,
  requiresCatalogMetadata,
  resolveCatalogMetadata,
  type CatalogFilters,
  type CatalogMetadata,
  type CatalogProduct,
  type CatalogSearchMode,
} from '@/lib/catalog'
import { createPublicServerClient } from '@/lib/supabase/server'

const CATALOG_CARD_SELECT = 'id, slug, product_type, brand, model, price, previous_price, condition, region, attributes, product_images(url, order)'
const CATALOG_METADATA_SELECT = 'id, product_type, condition, region, comuna, brand, model, description, price, previous_price, attributes, created_at, catalog_bumped_at'

export interface CatalogProductPage {
  products: CatalogProduct[]
  totalCount: number
  nextOffset: number
  hasMore: boolean
  searchMode: CatalogSearchMode | null
}

async function loadCatalogMetadata(): Promise<CatalogMetadata[]> {
  const supabase = createPublicServerClient()
  const { data, error } = await supabase
    .from('products')
    .select(CATALOG_METADATA_SELECT)
    .eq('status', 'approved')

  if (error) throw new Error(`catalog_metadata_failed:${error.code || 'database_error'}`)
  return (data || []) as CatalogMetadata[]
}

// Every catalog variant needs the same lightweight metadata to build filter
// counts. Reuse it briefly across navbar categories instead of repeating that
// database round trip for every click.
export const fetchCatalogMetadata = unstable_cache(
  loadCatalogMetadata,
  ['catalog-filter-metadata-v2'],
  { revalidate: 30 },
)

async function fetchDirectCatalogPage(
  supabase: SupabaseClient,
  filters: CatalogFilters,
  offset: number,
  pageSize: number,
): Promise<CatalogProductPage> {
  let query = supabase
    .from('products')
    .select(CATALOG_CARD_SELECT, { count: 'exact' })
    .eq('status', 'approved')

  if (filters.types.length > 0) query = query.in('product_type', filters.types)
  if (filters.conditions.length > 0) query = query.in('condition', filters.conditions)
  if (filters.regions.length > 0) query = query.in('region', filters.regions)
  if (filters.brands.length > 0) query = query.in('brand', filters.brands)
  if (filters.minPrice != null) query = query.gte('price', filters.minPrice)
  if (filters.maxPrice != null) query = query.lte('price', filters.maxPrice)

  if (filters.sort === 'price_asc') {
    query = query.order('price', { ascending: true }).order('catalog_bumped_at', { ascending: false })
  } else if (filters.sort === 'price_desc') {
    query = query.order('price', { ascending: false }).order('catalog_bumped_at', { ascending: false })
  } else {
    // A publication or price reduction moves the product to the head of the
    // same chronological queue. Later activity can always displace it.
    query = query.order('catalog_bumped_at', { ascending: false })
  }

  const { data, count, error } = await query
    .order('id', { ascending: true })
    .order('order', { referencedTable: 'product_images', ascending: true })
    .limit(2, { referencedTable: 'product_images' })
    .range(offset, offset + pageSize - 1)

  if (error) throw new Error(`catalog_products_failed:${error.code || 'database_error'}`)

  const products = (data || []) as CatalogProduct[]
  const totalCount = count || 0
  const nextOffset = offset + products.length

  return {
    products,
    totalCount,
    nextOffset,
    hasMore: nextOffset < totalCount,
    searchMode: null,
  }
}

async function fetchMetadataCatalogPage(
  supabase: SupabaseClient,
  filters: CatalogFilters,
  offset: number,
  metadata: CatalogMetadata[],
  pageSize: number,
): Promise<CatalogProductPage> {
  const resolved = resolveCatalogMetadata(metadata, filters)
  const page = resolved.products.slice(offset, offset + pageSize)
  const ids = page.map(product => product.id)

  if (ids.length === 0) {
    return {
      products: [],
      totalCount: resolved.products.length,
      nextOffset: offset,
      hasMore: false,
      searchMode: resolved.searchMode,
    }
  }

  const { data, error } = await supabase
    .from('products')
    .select(CATALOG_CARD_SELECT)
    .eq('status', 'approved')
    .in('id', ids)
    .order('order', { referencedTable: 'product_images', ascending: true })
    .limit(2, { referencedTable: 'product_images' })

  if (error) throw new Error(`catalog_products_failed:${error.code || 'database_error'}`)

  const byId = new Map(
    ((data || []) as CatalogProduct[]).map(product => [product.id, product]),
  )
  const products = ids
    .map(id => byId.get(id))
    .filter((product): product is CatalogProduct => product != null)
  const nextOffset = offset + page.length

  return {
    products,
    totalCount: resolved.products.length,
    nextOffset,
    hasMore: nextOffset < resolved.products.length,
    searchMode: resolved.searchMode,
  }
}

export async function fetchCatalogProductPage(
  supabase: SupabaseClient,
  filters: CatalogFilters,
  requestedOffset = 0,
  existingMetadata?: CatalogMetadata[],
  requestedPageSize = CATALOG_PAGE_SIZE,
): Promise<CatalogProductPage> {
  const offset = Math.max(0, Math.floor(requestedOffset))
  const pageSize = Math.max(1, Math.min(CATALOG_PAGE_SIZE, Math.floor(requestedPageSize)))

  if (!requiresCatalogMetadata(filters)) {
    return fetchDirectCatalogPage(supabase, filters, offset, pageSize)
  }

  const metadata = existingMetadata || await fetchCatalogMetadata()
  return fetchMetadataCatalogPage(supabase, filters, offset, metadata, pageSize)
}
