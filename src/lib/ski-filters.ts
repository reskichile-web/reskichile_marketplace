export const TIPO_OPTIONS: { value: string; label: string }[] = [
  { value: 'race', label: 'Race' },
  { value: 'pista', label: 'Pista' },
  { value: 'all_mountain', label: 'All mountain' },
  { value: 'freeride', label: 'Freeride' },
  { value: 'powder', label: 'Powder' },
  { value: 'freestyle', label: 'Freestyle' },
  { value: 'touring', label: 'Randoné' },
]

export const GENERO_OPTIONS: { value: string; label: string }[] = [
  { value: 'hombre', label: 'Hombre' },
  { value: 'mujer', label: 'Mujer' },
  { value: 'unisex', label: 'Unisex' },
  { value: 'junior', label: 'Junior' },
]

export interface Bucket {
  key: string
  label: string
  min: number
  max: number
}

export const ANCHO_BUCKETS: Bucket[] = [
  { key: 'lt85', label: 'Angosto (< 85 mm)', min: 0, max: 84.999 },
  { key: '85-100', label: 'Medio (85 – 100 mm)', min: 85, max: 99.999 },
  { key: '100-115', label: 'Ancho (100 – 115 mm)', min: 100, max: 114.999 },
  { key: 'gt115', label: 'Muy ancho (115 mm+)', min: 115, max: 9999 },
]

export const CONEXION_OPTIONS: { value: string; label: string }[] = [
  { value: 'Alpina (Normal)', label: 'Alpina' },
  { value: 'De pines', label: 'Pines' },
  { value: 'Híbrida', label: 'Híbrida' },
]

export function bucketAnchoKey(v: number): string | null {
  if (isNaN(v)) return null
  for (const b of ANCHO_BUCKETS) if (v >= b.min && v <= b.max) return b.key
  return null
}

export interface SkiCounts {
  tipo: Record<string, number>
  genero: Record<string, number>
  lengthMin?: number
  lengthMax?: number
  ancho: Record<string, number>
  fijYes: number
  fijNo: number
  conexion: Record<string, number>
}

interface ProductLike {
  product_type?: string | null
  attributes?: Record<string, unknown> | null
}

export function computeSkiCounts(esquisAll: ProductLike[]): SkiCounts {
  const out: SkiCounts = {
    tipo: {},
    genero: {},
    lengthMin: undefined,
    lengthMax: undefined,
    ancho: {},
    fijYes: 0,
    fijNo: 0,
    conexion: {},
  }
  for (const p of esquisAll) {
    const a = p.attributes || {}
    if (Array.isArray(a.tipo)) {
      for (const v of a.tipo as unknown[]) {
        if (typeof v === 'string') out.tipo[v] = (out.tipo[v] || 0) + 1
      }
    }
    if (Array.isArray(a.genero)) {
      for (const v of a.genero as unknown[]) {
        if (typeof v === 'string') out.genero[v] = (out.genero[v] || 0) + 1
      }
    }
    const l = Number(a.largo_cm)
    if (Number.isFinite(l) && l > 0) {
      out.lengthMin = out.lengthMin == null ? l : Math.min(out.lengthMin, l)
      out.lengthMax = out.lengthMax == null ? l : Math.max(out.lengthMax, l)
    }
    const w = Number(a.ancho_mm)
    const wk = bucketAnchoKey(w)
    if (wk) out.ancho[wk] = (out.ancho[wk] || 0) + 1
    if (a.incluye_fijaciones === true) out.fijYes++
    else if (a.incluye_fijaciones === false) out.fijNo++
    const c = a.fijaciones_tipo_conexion
    if (typeof c === 'string') out.conexion[c] = (out.conexion[c] || 0) + 1
  }
  return out
}

export function passesSkiFilters(
  attrs: Record<string, unknown> | null | undefined,
  filters: {
    tipo: string[]
    genero: string[]
    minLength?: number
    maxLength?: number
    ancho: string[]
    fij: string // '' | 'yes' | 'no'
    conexion: string[]
  }
): boolean {
  const a = attrs || {}
  if (filters.tipo.length > 0) {
    const t = a.tipo
    if (!Array.isArray(t)) return false
    if (!filters.tipo.some(v => (t as unknown[]).includes(v))) return false
  }
  if (filters.genero.length > 0) {
    const g = a.genero
    if (!Array.isArray(g)) return false
    if (!filters.genero.some(v => (g as unknown[]).includes(v))) return false
  }
  if (filters.minLength != null || filters.maxLength != null) {
    const v = Number(a.largo_cm)
    if (!Number.isFinite(v) || v <= 0) return false
    if (filters.minLength != null && v < filters.minLength) return false
    if (filters.maxLength != null && v > filters.maxLength) return false
  }
  if (filters.ancho.length > 0) {
    const v = Number(a.ancho_mm)
    const k = bucketAnchoKey(v)
    if (!k || !filters.ancho.includes(k)) return false
  }
  if (filters.fij === 'yes' && a.incluye_fijaciones !== true) return false
  if (filters.fij === 'no' && a.incluye_fijaciones !== false) return false
  if (filters.conexion.length > 0) {
    const c = a.fijaciones_tipo_conexion
    if (typeof c !== 'string' || !filters.conexion.includes(c)) return false
  }
  return true
}
