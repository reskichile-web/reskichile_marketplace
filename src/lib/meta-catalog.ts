import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { CONDITIONS, PRODUCT_TYPES } from '@/lib/constants'

const SITE_ORIGIN = 'https://www.reskichile.cl'
const FEED_PAGE_SIZE = 500
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const META_CATALOG_SELECT = [
  'id',
  'slug',
  'product_type',
  'brand',
  'model',
  'description',
  'condition',
  'price',
  'region',
  'product_images(url, order)',
].join(', ')

export const META_CATALOG_COLUMNS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
  'product_type',
  'custom_label_0',
  'custom_label_1',
  'custom_label_2',
] as const

interface MetaCatalogSourceImage {
  url: string
  order: number | null
}

export interface MetaCatalogSourceProduct {
  id: string
  slug: string | null
  product_type: string
  brand: string
  model: string | null
  description: string | null
  condition: string
  price: number
  region: string | null
  product_images: MetaCatalogSourceImage[] | null
}

export interface MetaCatalogRow {
  id: string
  title: string
  description: string
  availability: 'in stock'
  condition: 'new' | 'used'
  price: string
  link: string
  image_link: string
  brand: string
  product_type: string
  custom_label_0: string
  custom_label_1: string
  custom_label_2: string
}

export interface MetaCatalogFeed {
  csv: string
  sourceCount: number
  includedCount: number
  excludedProductIds: string[]
}

function cleanText(value: string | null | undefined, maxLength: number): string {
  return (value ?? '')
    .replace(/\0/g, '')
    .trim()
    .slice(0, maxLength)
}

function humanize(value: string): string {
  const normalized = value.replace(/_/g, ' ').trim()
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : ''
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function metaCondition(condition: string): MetaCatalogRow['condition'] | null {
  if (condition === 'nuevo' || condition === 'nuevo_sellado') return 'new'
  if (
    condition === 'usado_como_nuevo' ||
    condition === 'usado_buen_estado' ||
    condition === 'usado_aceptable'
  ) return 'used'
  return null
}

function primaryImage(product: MetaCatalogSourceProduct): string | null {
  const images = [...(product.product_images ?? [])]
    .sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER))

  return images
    .map(image => cleanText(image.url, 2_000))
    .find(isHttpUrl) ?? null
}

export function toMetaCatalogRow(product: MetaCatalogSourceProduct): MetaCatalogRow | null {
  const id = cleanText(product.id, 100)
  const slug = cleanText(product.slug, 300)
  const brand = cleanText(product.brand, 100)
  const typeLabel = cleanText(PRODUCT_TYPES[product.product_type] ?? humanize(product.product_type), 750)
  const condition = metaCondition(product.condition)
  const imageLink = primaryImage(product)
  const price = Number(product.price)

  if (
    !UUID_RE.test(id) ||
    !slug ||
    !brand ||
    !typeLabel ||
    !condition ||
    !imageLink ||
    !Number.isInteger(price) ||
    price <= 0
  ) {
    return null
  }

  const model = cleanText(product.model, 120)
  const title = cleanText([brand, model || typeLabel].join(' '), 200)
  const conditionLabel = CONDITIONS[product.condition] ?? humanize(product.condition)
  const fallbackDescription = `${title}. ${typeLabel}. Condición: ${conditionLabel}.`
  const description = cleanText(product.description, 5_000) || fallbackDescription
  const link = new URL(`/producto/${encodeURIComponent(slug)}`, SITE_ORIGIN).toString()

  return {
    id,
    title,
    description,
    availability: 'in stock',
    condition,
    price: `${price} CLP`,
    link,
    image_link: imageLink,
    brand,
    product_type: typeLabel,
    custom_label_0: cleanText(product.product_type, 100),
    custom_label_1: cleanText(product.condition, 100),
    custom_label_2: cleanText(product.region, 100),
  }
}

function escapeCsv(value: string): string {
  const normalized = value.replace(/\r\n?/g, '\n')
  return `"${normalized.replace(/"/g, '""')}"`
}

export function serializeMetaCatalogCsv(rows: MetaCatalogRow[]): string {
  const header = META_CATALOG_COLUMNS.join(',')
  const body = rows.map(row => (
    META_CATALOG_COLUMNS.map(column => escapeCsv(row[column])).join(',')
  ))

  return `${[header, ...body].join('\r\n')}\r\n`
}

export async function fetchMetaCatalogProducts(
  supabase: SupabaseClient,
): Promise<MetaCatalogSourceProduct[]> {
  const products: MetaCatalogSourceProduct[] = []

  for (let offset = 0; ; offset += FEED_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('products')
      .select(META_CATALOG_SELECT)
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .order('order', { referencedTable: 'product_images', ascending: true })
      .limit(10, { referencedTable: 'product_images' })
      .range(offset, offset + FEED_PAGE_SIZE - 1)

    if (error) {
      throw new Error(`meta_catalog_query_failed:${error.code || 'database_error'}`)
    }

    const page = (data ?? []) as unknown as MetaCatalogSourceProduct[]
    products.push(...page)
    if (page.length < FEED_PAGE_SIZE) break
  }

  return products
}

export async function buildMetaCatalogFeed(
  supabase: SupabaseClient,
): Promise<MetaCatalogFeed> {
  const products = await fetchMetaCatalogProducts(supabase)
  const rows: MetaCatalogRow[] = []
  const excludedProductIds: string[] = []

  for (const product of products) {
    const row = toMetaCatalogRow(product)
    if (row) rows.push(row)
    else excludedProductIds.push(product.id)
  }

  // An empty marketplace is valid. A non-empty marketplace where every row is
  // malformed is not: returning only a header could delete the last good Meta
  // import when deletion of absent items is enabled.
  if (products.length > 0 && rows.length === 0) {
    throw new Error('meta_catalog_all_products_invalid')
  }

  return {
    csv: serializeMetaCatalogCsv(rows),
    sourceCount: products.length,
    includedCount: rows.length,
    excludedProductIds,
  }
}
