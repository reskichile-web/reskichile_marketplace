import { passesBootFilters } from '@/lib/boot-filters'
import { passesSkiFilters } from '@/lib/ski-filters'

export const CATALOG_PAGE_SIZE = 24

export type CatalogSort = 'recent' | 'price_asc' | 'price_desc'

export interface CatalogFilters {
  types: string[]
  conditions: string[]
  regions: string[]
  brands: string[]
  minPrice?: number
  maxPrice?: number
  sort: CatalogSort
  tipo: string[]
  genero: string[]
  largo: string[]
  ancho: string[]
  fij: string
  conexion: string[]
  bootSize: string[]
  bootFlex: string[]
  bootBoa: string
}

export interface CatalogMetadata {
  id: string
  product_type: string
  condition: string
  region: string
  brand: string | null
  price: number
  attributes: Record<string, unknown> | null
  created_at: string
}

export interface CatalogProduct {
  id: string
  slug: string | null
  product_type: string
  brand: string | null
  model: string | null
  price: number
  condition?: string
  attributes: Record<string, unknown> | null
  product_images: { url: string; order: number }[]
}

type CatalogParamSource =
  | URLSearchParams
  | Record<string, string | string[] | undefined>

function readParam(source: CatalogParamSource, key: string): string {
  if ('get' in source && typeof source.get === 'function') {
    return source.get(key) || ''
  }

  const value = (source as Record<string, string | string[] | undefined>)[key]
  return typeof value === 'string' ? value : ''
}

function readList(source: CatalogParamSource, key: string): string[] {
  return Array.from(new Set(
    readParam(source, key)
      .split(',')
      .map(value => value.trim())
      .filter(value => value.length > 0 && value.length <= 100)
      .slice(0, 20),
  ))
}

function readPrice(source: CatalogParamSource, key: string): number | undefined {
  const raw = readParam(source, key)
  if (!raw) return undefined

  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

export function parseCatalogFilters(source: CatalogParamSource): CatalogFilters {
  const requestedSort = readParam(source, 'sort')
  const sort: CatalogSort = requestedSort === 'price_asc' || requestedSort === 'price_desc'
    ? requestedSort
    : 'recent'
  const fij = readParam(source, 'fij')
  const bootBoa = readParam(source, 'boot_boa')

  return {
    types: readList(source, 'product_type'),
    conditions: readList(source, 'condition'),
    regions: readList(source, 'region'),
    brands: readList(source, 'brand'),
    minPrice: readPrice(source, 'min_price'),
    maxPrice: readPrice(source, 'max_price'),
    sort,
    tipo: readList(source, 'tipo'),
    genero: readList(source, 'genero'),
    largo: readList(source, 'largo'),
    ancho: readList(source, 'ancho'),
    fij: fij === 'yes' || fij === 'no' ? fij : '',
    conexion: readList(source, 'conexion'),
    bootSize: readList(source, 'boot_size'),
    bootFlex: readList(source, 'boot_flex'),
    bootBoa: bootBoa === 'yes' || bootBoa === 'no' ? bootBoa : '',
  }
}

export function hasCatalogAttributeFilters(filters: CatalogFilters): boolean {
  const isEsquisOnly = filters.types.length === 1 && filters.types[0] === 'esquis'
  const isSkiBootsOnly = filters.types.length === 1 && filters.types[0] === 'botas_esqui'
  const isSnowboardBootsOnly = filters.types.length === 1 && filters.types[0] === 'botas_snowboard'

  return (
    (isEsquisOnly && (
      filters.tipo.length > 0 ||
      filters.genero.length > 0 ||
      filters.largo.length > 0 ||
      filters.ancho.length > 0 ||
      filters.fij !== '' ||
      filters.conexion.length > 0
    )) ||
    ((isSkiBootsOnly || isSnowboardBootsOnly) && (
      filters.bootSize.length > 0 ||
      filters.bootFlex.length > 0 ||
      filters.genero.length > 0 ||
      filters.bootBoa !== ''
    ))
  )
}

export function filterCatalogMetadata(
  products: CatalogMetadata[],
  filters: CatalogFilters,
): CatalogMetadata[] {
  const isEsquisOnly = filters.types.length === 1 && filters.types[0] === 'esquis'
  const isSkiBootsOnly = filters.types.length === 1 && filters.types[0] === 'botas_esqui'
  const isSnowboardBootsOnly = filters.types.length === 1 && filters.types[0] === 'botas_snowboard'

  return products.filter(product => {
    if (filters.types.length > 0 && !filters.types.includes(product.product_type)) return false
    if (filters.conditions.length > 0 && !filters.conditions.includes(product.condition)) return false
    if (filters.regions.length > 0 && !filters.regions.includes(product.region)) return false
    if (filters.brands.length > 0 && (!product.brand || !filters.brands.includes(product.brand))) return false
    if (filters.minPrice != null && product.price < filters.minPrice) return false
    if (filters.maxPrice != null && product.price > filters.maxPrice) return false

    if (isEsquisOnly && !passesSkiFilters(product.attributes, {
      tipo: filters.tipo,
      genero: filters.genero,
      largo: filters.largo,
      ancho: filters.ancho,
      fij: filters.fij,
      conexion: filters.conexion,
    })) return false

    if ((isSkiBootsOnly || isSnowboardBootsOnly) && !passesBootFilters(product.attributes, {
      size: filters.bootSize,
      flex: isSkiBootsOnly ? filters.bootFlex : [],
      gender: filters.genero,
      boa: filters.bootBoa,
    })) return false

    return true
  })
}

function compareRecent(a: CatalogMetadata, b: CatalogMetadata): number {
  return b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)
}

export function sortCatalogMetadata(
  products: CatalogMetadata[],
  sort: CatalogSort,
): CatalogMetadata[] {
  return [...products].sort((a, b) => {
    if (sort === 'price_asc') return a.price - b.price || compareRecent(a, b)
    if (sort === 'price_desc') return b.price - a.price || compareRecent(a, b)
    return compareRecent(a, b)
  })
}

export function pageCatalogMetadata(
  products: CatalogMetadata[],
  filters: CatalogFilters,
  offset: number,
  pageSize = CATALOG_PAGE_SIZE,
): CatalogMetadata[] {
  const start = Math.max(0, Math.floor(offset))
  return sortCatalogMetadata(filterCatalogMetadata(products, filters), filters.sort)
    .slice(start, start + pageSize)
}
