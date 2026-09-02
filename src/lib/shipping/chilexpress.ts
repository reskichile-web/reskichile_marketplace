import 'server-only'

export interface ChilexpressConfig {
  baseUrl: string
  ratingApiKey: string
  coverageApiKey: string
  customerCardNumber?: string
  timeoutMs: number
}

export interface ChilexpressPlace {
  region: string
  commune: string
}

export interface ChilexpressPackage {
  weightKg: number
  heightCm: number
  widthCm: number
  lengthCm: number
}

export interface ChilexpressQuote {
  amountClp: number
  serviceCode: string
  serviceDescription: string
  originCoverageCode: string
  destinationCoverageCode: string
}

export class ChilexpressError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChilexpressError'
  }
}

interface CachedValue<T> {
  expiresAt: number
  value: T
}

const CACHE_MS = 6 * 60 * 60 * 1000
const regionCache = new Map<string, CachedValue<Array<{ id: string; name: string }>>>()
const coverageCache = new Map<string, CachedValue<Array<{ code: string; name: string }>>>()

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(region|region del|region de|region metropolitana de)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

async function chilexpressJson(
  config: ChilexpressConfig,
  path: string,
  apiKey: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetch(new URL(path, config.baseUrl), {
    ...init,
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(config.timeoutMs),
  })
  const json = asRecord(await response.json().catch(() => null))
  if (!response.ok || !json) {
    throw new ChilexpressError(`Chilexpress respondió ${response.status}`)
  }
  return json
}

async function regions(config: ChilexpressConfig) {
  const key = config.baseUrl
  const cached = regionCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const json = await chilexpressJson(
    config,
    'georeference/v2/api/v2.0/regions',
    config.coverageApiKey,
  )
  const value = Array.isArray(json.regions)
    ? json.regions.flatMap(raw => {
        const region = asRecord(raw)
        const id = typeof region?.regionId === 'string' ? region.regionId : ''
        const name = typeof region?.regionName === 'string' ? region.regionName : ''
        return id && name ? [{ id, name }] : []
      })
    : []
  if (value.length === 0) throw new ChilexpressError('Chilexpress no devolvió regiones')
  regionCache.set(key, { expiresAt: Date.now() + CACHE_MS, value })
  return value
}

async function coverages(config: ChilexpressConfig, regionId: string) {
  const key = `${config.baseUrl}:${regionId}`
  const cached = coverageCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const json = await chilexpressJson(
    config,
    `georeference/v2/api/V1.0/coverage-areas?RegionCode=${encodeURIComponent(regionId)}&type=0`,
    config.coverageApiKey,
  )
  const value = Array.isArray(json.coverageAreas)
    ? json.coverageAreas.flatMap(raw => {
        const coverage = asRecord(raw)
        const code = typeof coverage?.countyCode === 'string' ? coverage.countyCode : ''
        const name = typeof coverage?.coverageName === 'string' ? coverage.coverageName : ''
        return code && code !== 'SCOB' && name ? [{ code, name }] : []
      })
    : []
  if (value.length === 0) throw new ChilexpressError('Chilexpress no devolvió comunas')
  coverageCache.set(key, { expiresAt: Date.now() + CACHE_MS, value })
  return value
}

async function coverageCode(config: ChilexpressConfig, place: ChilexpressPlace) {
  const allRegions = await regions(config)
  const targetRegion = normalized(place.region)
  const region = allRegions.find(item => {
    const candidate = normalized(item.name)
    return candidate === targetRegion || candidate.includes(targetRegion) || targetRegion.includes(candidate)
  })
  if (!region) throw new ChilexpressError('Región sin cobertura Chilexpress')

  const allCoverages = await coverages(config, region.id)
  const targetCommune = normalized(place.commune)
  const coverage = allCoverages.find(item => normalized(item.name) === targetCommune)
  if (!coverage) throw new ChilexpressError('Comuna sin cobertura Chilexpress')
  return coverage.code
}

export async function quoteChilexpress(
  config: ChilexpressConfig,
  origin: ChilexpressPlace,
  destination: ChilexpressPlace,
  parcel: ChilexpressPackage,
  declaredWorthClp: number,
): Promise<ChilexpressQuote> {
  const [originCountyCode, destinationCountyCode] = await Promise.all([
    coverageCode(config, origin),
    coverageCode(config, destination),
  ])
  const payload: Record<string, unknown> = {
    originCountyCode,
    destinationCountyCode,
    package: {
      weight: parcel.weightKg,
      height: parcel.heightCm,
      width: parcel.widthCm,
      length: parcel.lengthCm,
    },
    productType: 3,
    contentType: 1,
    declaredWorth: declaredWorthClp,
    deliveryTime: 0,
  }
  if (config.customerCardNumber) {
    payload.customerCardNumber = config.customerCardNumber
  }

  const json = await chilexpressJson(
    config,
    'rating/api/v1.0/rates/business',
    config.ratingApiKey,
    { method: 'POST', body: JSON.stringify(payload) },
  )
  const data = asRecord(json.data)
  const excluded = new Set([11, 14, 15, 16, 43, 44, 45, 46, 47, 48])
  const options = Array.isArray(data?.courierServiceOptions)
    ? data.courierServiceOptions.flatMap(raw => {
        const option = asRecord(raw)
        const code = Number(option?.serviceTypeCode)
        const amount = Number(option?.serviceValueDiscount)
        const description = typeof option?.serviceDescription === 'string'
          ? option.serviceDescription.trim()
          : ''
        if (
          !Number.isSafeInteger(code) || excluded.has(code) ||
          !Number.isSafeInteger(amount) || amount < 0 || amount > 10000000 ||
          !description
        ) return []
        return [{ code, amount, description }]
      })
    : []
  options.sort((a, b) => a.amount - b.amount || a.code - b.code)
  const selected = options[0]
  if (!selected) throw new ChilexpressError('Chilexpress no devolvió tarifas válidas')

  return {
    amountClp: selected.amount,
    serviceCode: String(selected.code),
    serviceDescription: selected.description,
    originCoverageCode: originCountyCode,
    destinationCoverageCode: destinationCountyCode,
  }
}
