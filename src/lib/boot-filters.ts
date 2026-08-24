import { GENERO_CHOICES, MONDO_SIZE_BANDS } from '@/lib/constants'

export const BOOT_GENDER_OPTIONS = GENERO_CHOICES

export interface BootCounts {
  size: Record<string, number>
  flex: Record<string, number>
  gender: Record<string, number>
  boaYes: number
  boaNo: number
}

interface ProductLike {
  product_type?: string | null
  attributes?: Record<string, unknown> | null
}

export function normalizeMondoBand(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const normalized = String(value).trim().replace(/,/g, '.')
  if (!normalized) return null

  const canonical = MONDO_SIZE_BANDS.find(option => option === normalized)
  if (canonical) return canonical

  const numbers = normalized.match(/\d+(?:\.\d+)?/g)?.map(Number) || []
  const mondo = numbers.find(number => number >= 18 && number <= 33.5)
  if (mondo == null) return null

  // A decimal such as 23.3 is a foot measurement and belongs to the nearest
  // half-size. A canonical band always starts at the integer Mondo size.
  const rounded = Math.round(mondo * 2) / 2
  const base = Math.floor(rounded)
  const band = `${base}/${base}.5`
  return MONDO_SIZE_BANDS.includes(band) ? band : null
}

export function normalizeFlex(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const numbers = String(value).replace(/,/g, '.').match(/\d+(?:\.\d+)?/g)?.map(Number) || []
  if (numbers.length === 0) return null
  const average = numbers.reduce((sum, number) => sum + number, 0) / numbers.length
  const normalized = Math.round(average / 5) * 5
  if (normalized < 40 || normalized > 150) return null
  return String(normalized)
}

function normalizedGender(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const genders = value.filter(item => typeof item === 'string') as string[]
  if (genders.includes('unisex')) return ['unisex']
  if (genders.includes('hombre') && genders.includes('mujer')) return ['unisex']
  return genders
}

export function computeBootCounts(products: ProductLike[]): BootCounts {
  const counts: BootCounts = {
    size: {},
    flex: {},
    gender: {},
    boaYes: 0,
    boaNo: 0,
  }

  for (const product of products) {
    const attributes = product.attributes || {}
    const size = normalizeMondoBand(attributes.talla_mondo)
    if (size) counts.size[size] = (counts.size[size] || 0) + 1

    const flex = normalizeFlex(attributes.flex)
    if (flex) counts.flex[flex] = (counts.flex[flex] || 0) + 1

    for (const gender of normalizedGender(attributes.genero)) {
      counts.gender[gender] = (counts.gender[gender] || 0) + 1
    }

    if (attributes.boa === true) counts.boaYes++
    else if (attributes.boa === false) counts.boaNo++

  }

  return counts
}

export interface BootFilters {
  size: string[]
  flex: string[]
  gender: string[]
  boa: string
}

export function passesBootFilters(
  attributes: Record<string, unknown> | null | undefined,
  filters: BootFilters,
): boolean {
  const attrs = attributes || {}

  if (filters.size.length > 0) {
    const size = normalizeMondoBand(attrs.talla_mondo)
    if (!size || !filters.size.includes(size)) return false
  }

  if (filters.flex.length > 0) {
    const flex = normalizeFlex(attrs.flex)
    if (!flex || !filters.flex.includes(flex)) return false
  }

  if (filters.gender.length > 0) {
    const gender = normalizedGender(attrs.genero)
    if (!filters.gender.some(value => gender.includes(value))) return false
  }

  if (filters.boa === 'yes' && attrs.boa !== true) return false
  if (filters.boa === 'no' && attrs.boa !== false) return false

  return true
}
