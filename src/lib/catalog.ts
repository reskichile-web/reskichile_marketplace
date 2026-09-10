import { passesBootFilters } from '@/lib/boot-filters'
import { passesSkiFilters } from '@/lib/ski-filters'

export const CATALOG_PAGE_SIZE = 24

export type CatalogSort = 'relevance' | 'recent' | 'price_asc' | 'price_desc'
export type CatalogSearchMode = 'exact' | 'approximate' | 'fallback'

export interface CatalogFilters {
  query: string
  types: string[]
  conditions: string[]
  regions: string[]
  brands: string[]
  minPrice?: number
  maxPrice?: number
  sort: CatalogSort
  tipo: string[]
  genero: string[]
  minLength?: number
  maxLength?: number
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
  model?: string | null
  description?: string | null
  comuna?: string | null
  price: number
  previous_price?: number | null
  attributes: Record<string, unknown> | null
  created_at: string
  catalog_bumped_at?: string | null
}

export interface CatalogProduct {
  id: string
  slug: string | null
  product_type: string
  brand: string | null
  model: string | null
  price: number
  previous_price?: number | null
  condition?: string
  region?: string
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

function readLength(source: CatalogParamSource, key: string): number | undefined {
  const value = readPrice(source, key)
  return value != null && value > 0 && value <= 400 ? value : undefined
}

function readSearchQuery(source: CatalogParamSource): string {
  return readParam(source, 'q')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

export function parseCatalogFilters(source: CatalogParamSource): CatalogFilters {
  const query = readSearchQuery(source)
  const requestedSort = readParam(source, 'sort')
  const sort: CatalogSort = requestedSort === 'price_asc' || requestedSort === 'price_desc' || requestedSort === 'recent' || requestedSort === 'relevance'
    ? requestedSort
    : query ? 'relevance' : 'recent'
  const fij = readParam(source, 'fij')
  const bootBoa = readParam(source, 'boot_boa')
  const requestedMinLength = readLength(source, 'min_length')
  const requestedMaxLength = readLength(source, 'max_length')
  const minLength = requestedMinLength != null && requestedMaxLength != null
    ? Math.min(requestedMinLength, requestedMaxLength)
    : requestedMinLength
  const maxLength = requestedMinLength != null && requestedMaxLength != null
    ? Math.max(requestedMinLength, requestedMaxLength)
    : requestedMaxLength

  return {
    query,
    types: readList(source, 'product_type'),
    conditions: readList(source, 'condition'),
    regions: readList(source, 'region'),
    brands: readList(source, 'brand'),
    minPrice: readPrice(source, 'min_price'),
    maxPrice: readPrice(source, 'max_price'),
    sort,
    tipo: readList(source, 'tipo'),
    genero: readList(source, 'genero'),
    minLength,
    maxLength,
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
      filters.minLength != null ||
      filters.maxLength != null ||
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

export function requiresCatalogMetadata(filters: CatalogFilters): boolean {
  return filters.query.length > 0 || hasCatalogAttributeFilters(filters)
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
      minLength: filters.minLength,
      maxLength: filters.maxLength,
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
  const aCatalogDate = a.catalog_bumped_at || a.created_at || ''
  const bCatalogDate = b.catalog_bumped_at || b.created_at || ''
  return bCatalogDate.localeCompare(aCatalogDate) || a.id.localeCompare(b.id)
}

const PRODUCT_TYPE_SEARCH_TERMS: Record<string, string> = {
  esquis: 'esqui esquies ski skis tablas palillos',
  snowboards: 'snowboard snowboards tabla tablas snow',
  botas_esqui: 'bota botas esqui ski boots calzado',
  botas_snowboard: 'bota botas snowboard snow boots calzado',
  bastones: 'baston bastones poles',
  cascos: 'casco cascos helmet proteccion cabeza',
  guantes: 'guante guantes gloves mitones',
  fijaciones: 'fijacion fijaciones bindings binding',
  parkas: 'parka parkas chaqueta chaquetas jacket abrigo',
  pantalones: 'pantalon pantalones pants ropa',
  antiparras: 'antiparra antiparras goggles lentes mascara',
  mochilas: 'mochila mochilas backpack',
  bolsos: 'bolso bolsos bag',
  equipo_avalanchas: 'equipo avalancha avalanchas arva pala sonda seguridad',
  camaras_accion: 'camara camaras accion gopro video',
  equipos_completos: 'equipo equipos completo completos pack set ski snowboard',
  otros: 'otro otros accesorio accesorios',
}

const SEARCH_STOP_WORDS = new Set([
  'a', 'al', 'algo', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'lo', 'los', 'me', 'mi',
  'para', 'por', 'puta', 'putas', 'pura', 'puras', 'que', 'quiero', 'tontera', 'tonteras',
  'un', 'una', 'unas', 'uno', 'unos', 'wea', 'weas', 'y',
])

function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function searchableAttributeText(attributes: Record<string, unknown> | null): string {
  if (!attributes) return ''

  return Object.entries(attributes)
    .flatMap(([key, rawValue]) => {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue]
      return [key.replace(/_/g, ' '), ...values.map(value => String(value))]
    })
    .join(' ')
}

function editSimilarity(left: string, right: string): number {
  if (left === right) return 1
  if (!left.length || !right.length) return 0
  if (Math.abs(left.length - right.length) > 3) return 0

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0]
    previous[0] = leftIndex
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex]
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + cost,
      )
      diagonal = above
    }
  }

  return 1 - (previous[right.length] / Math.max(left.length, right.length))
}

function tokenMatchScore(token: string, words: string[], fullText: string): number {
  if (words.includes(token)) return 1
  if (token.length >= 2 && words.some(word => (
    word.startsWith(token) ||
    (word.length >= 3 && token.startsWith(word) && token.length - word.length <= 2)
  ))) return 0.9
  if (token.length >= 3 && fullText.includes(token)) return 0.82
  if (token.length < 3) return 0

  let best = 0
  for (const word of words) {
    if (word.length < 3) continue
    best = Math.max(best, editSimilarity(token, word))
    if (best >= 0.9) break
  }
  return best
}

interface RankedCatalogProduct {
  product: CatalogMetadata
  score: number
  exact: boolean
  candidate: boolean
}

function rankCatalogProduct(product: CatalogMetadata, query: string): RankedCatalogProduct {
  const primary = normalizeSearchText([
    product.brand,
    product.model,
    product.product_type.replace(/_/g, ' '),
    PRODUCT_TYPE_SEARCH_TERMS[product.product_type] || '',
  ].filter(Boolean).join(' '))
  const secondary = normalizeSearchText([
    product.condition.replace(/_/g, ' '),
    product.region,
    product.comuna,
    product.description,
    searchableAttributeText(product.attributes),
  ].filter(Boolean).join(' '))
  const allText = `${primary} ${secondary}`.trim()
  const primaryWords = primary.split(' ').filter(Boolean)
  const allWords = allText.split(' ').filter(Boolean)
  const normalizedQuery = normalizeSearchText(query)
  const rawTokens = normalizedQuery.split(' ').filter(Boolean)
  const usefulTokens = rawTokens.filter(token => !SEARCH_STOP_WORDS.has(token))
  const tokens = usefulTokens
  const scores = tokens.map(token => {
    const primaryScore = tokenMatchScore(token, primaryWords, primary)
    const allScore = tokenMatchScore(token, allWords, allText)
    return Math.max(primaryScore * 1.25, allScore)
  })
  const matched = scores.filter(score => score >= 0.58).length
  const best = scores.length > 0 ? Math.max(...scores) : 0
  const coverage = scores.length > 0 ? matched / scores.length : 0
  const average = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0
  const phraseBoost = normalizedQuery.length >= 3 && primary.includes(normalizedQuery) ? 1.5
    : normalizedQuery.length >= 3 && allText.includes(normalizedQuery) ? 0.75
      : 0
  const directMatch = (token: string) => allWords.includes(token) || (
    token.length >= 2 && allWords.some(word => (
      word.startsWith(token) ||
      (word.length >= 3 && token.startsWith(word) && token.length - word.length <= 2)
    ))
  ) || (token.length >= 3 && allText.includes(token))

  return {
    product,
    score: phraseBoost + (best * 2) + average + coverage + matched * 0.2,
    exact: tokens.length > 0 && tokens.every(directMatch),
    candidate: best >= 0.8 || (matched >= 2 && coverage >= 0.5),
  }
}

export interface ResolvedCatalogMetadata {
  products: CatalogMetadata[]
  searchMode: CatalogSearchMode | null
}

export function resolveCatalogMetadata(
  products: CatalogMetadata[],
  filters: CatalogFilters,
): ResolvedCatalogMetadata {
  const filtered = filterCatalogMetadata(products, filters)
  if (!filters.query) {
    return { products: sortCatalogMetadata(filtered, filters.sort), searchMode: null }
  }

  const ranked = filtered
    .map(product => rankCatalogProduct(product, filters.query))
    .filter(result => result.candidate)
    .sort((a, b) => b.score - a.score || compareRecent(a.product, b.product))
  const hasExactMatch = ranked.some(result => result.exact)

  if (ranked.length === 0) {
    return {
      products: sortCatalogMetadata(filtered, filters.sort === 'relevance' ? 'recent' : filters.sort),
      searchMode: 'fallback',
    }
  }

  const matchedProducts = ranked.map(result => result.product)
  return {
    products: filters.sort === 'relevance'
      ? matchedProducts
      : sortCatalogMetadata(matchedProducts, filters.sort),
    searchMode: hasExactMatch ? 'exact' : 'approximate',
  }
}

export function sortCatalogMetadata(
  products: CatalogMetadata[],
  sort: CatalogSort,
): CatalogMetadata[] {
  return [...products].sort((a, b) => {
    if (sort === 'price_asc') return a.price - b.price || compareRecent(a, b)
    if (sort === 'price_desc') return b.price - a.price || compareRecent(a, b)
    // Query-specific relevance is handled by resolveCatalogMetadata. Outside
    // that context, relevance safely degrades to chronological order.
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
  return resolveCatalogMetadata(products, filters).products.slice(start, start + pageSize)
}
