import 'server-only'

export interface StarkenConfig {
  baseUrl: string
  apiToken: string
  currentAccount: string
  currentAccountDv: string
  timeoutMs: number
}

export interface StarkenPlace {
  region: string
  commune: string
}

export interface StarkenPackage {
  weightKg: number
  heightCm: number
  widthCm: number
  lengthCm: number
}

export interface StarkenQuote {
  amountClp: number
  serviceCode: string
  deliveryType: 'DOMICILIO'
  paymentType: 2
  originCityCode: number
  destinationCityCode: number
}

export class StarkenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StarkenError'
  }
}

interface StarkenCommune {
  name: string
  cityCode: number
  regionName: string | null
}

interface CachedValue<T> {
  expiresAt: number
  value: T
}

const CACHE_MS = 6 * 60 * 60 * 1000
const communeCache = new Map<string, CachedValue<StarkenCommune[]>>()
const pendingCommuneCache = new Map<string, Promise<StarkenCommune[]>>()

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizedRegion(value: string): string {
  return normalized(value)
    .replace(/\b(region|de|del|la|las|los|santiago)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function apiUrl(config: StarkenConfig, path: string): URL {
  const baseUrl = config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`
  return new URL(path.replace(/^\/+/, ''), baseUrl)
}

async function starkenJson(
  config: StarkenConfig,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  try {
    const response = await fetch(apiUrl(config, path), {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${config.apiToken}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(config.timeoutMs),
    })
    const json = await response.json().catch(() => null)
    if (!response.ok || json == null) {
      throw new StarkenError(`Starken respondió ${response.status}`)
    }
    return json
  } catch (error) {
    if (error instanceof StarkenError) throw error
    throw new StarkenError('No fue posible conectar con Starken')
  }
}

function communeRows(json: unknown): unknown[] {
  if (Array.isArray(json)) return json
  const record = asRecord(json)
  if (Array.isArray(record?.data)) return record.data
  if (Array.isArray(record?.communes)) return record.communes
  return []
}

async function communes(config: StarkenConfig): Promise<StarkenCommune[]> {
  const key = config.baseUrl
  const cached = communeCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  const pending = pendingCommuneCache.get(key)
  if (pending) return pending

  const load = (async () => {
    const json = await starkenJson(config, 'agency/comuna')
    const value = communeRows(json).flatMap(raw => {
      const commune = asRecord(raw)
      const city = asRecord(commune?.city)
      const region = asRecord(city?.region) || asRecord(commune?.region)
      const name = textValue(commune?.name || commune?.nombre)
      const cityCode = Number(city?.code_dls ?? city?.codigoDls ?? city?.code)
      const regionName = textValue(region?.name || region?.nombre) || null
      return name && Number.isSafeInteger(cityCode) && cityCode > 0
        ? [{ name, cityCode, regionName }]
        : []
    })
    if (value.length === 0) {
      throw new StarkenError('Starken no devolvió comunas válidas')
    }
    communeCache.set(key, { expiresAt: Date.now() + CACHE_MS, value })
    return value
  })()
  pendingCommuneCache.set(key, load)
  try {
    return await load
  } finally {
    pendingCommuneCache.delete(key)
  }
}

async function cityCode(config: StarkenConfig, place: StarkenPlace): Promise<number> {
  const allCommunes = await communes(config)
  const targetCommune = normalized(place.commune)
  const matchingCommunes = allCommunes.filter(item => normalized(item.name) === targetCommune)
  if (matchingCommunes.length === 1) return matchingCommunes[0].cityCode

  const targetRegion = normalizedRegion(place.region)
  const matchingRegion = matchingCommunes.find(item => (
    item.regionName != null && (
      normalizedRegion(item.regionName) === targetRegion ||
      normalizedRegion(item.regionName).includes(targetRegion) ||
      targetRegion.includes(normalizedRegion(item.regionName))
    )
  ))
  if (matchingRegion) return matchingRegion.cityCode

  throw new StarkenError('Comuna sin cobertura única de Starken')
}

function validPackage(parcel: StarkenPackage): boolean {
  return [parcel.weightKg, parcel.heightCm, parcel.widthCm, parcel.lengthCm]
    .every(value => Number.isFinite(value) && value > 0 && value <= 10000)
}

export async function quoteStarken(
  config: StarkenConfig,
  origin: StarkenPlace,
  destination: StarkenPlace,
  parcel: StarkenPackage,
): Promise<StarkenQuote> {
  if (!validPackage(parcel)) {
    throw new StarkenError('El paquete no tiene dimensiones válidas')
  }

  const [originCityCode, destinationCityCode] = await Promise.all([
    cityCode(config, origin),
    cityCode(config, destination),
  ])
  const json = await starkenJson(config, 'quote/cotizador-multiple', {
    method: 'POST',
    body: JSON.stringify({
      origen: originCityCode,
      destino: destinationCityCode,
      bulto: 'BULTO',
      alto: Number(parcel.heightCm.toFixed(2)),
      ancho: Number(parcel.widthCm.toFixed(2)),
      largo: Number(parcel.lengthCm.toFixed(2)),
      kilos: Number(parcel.weightKg.toFixed(2)),
      todas_alternativas: true,
      ctacte: config.currentAccount,
      ctacte_dv: config.currentAccountDv,
    }),
  })
  const record = asRecord(json)
  const alternatives = Array.isArray(record?.alternativas) ? record.alternativas : []
  const options = alternatives.flatMap(raw => {
    const option = asRecord(raw)
    const amount = Number(option?.precio)
    const service = textValue(option?.servicio).toUpperCase()
    const delivery = textValue(option?.entrega).toUpperCase()
    const paymentType = Number(option?.codigo_tipo_pago)
    if (
      delivery !== 'DOMICILIO' || paymentType !== 2 ||
      !Number.isSafeInteger(amount) || amount < 0 || amount > 10000000 ||
      !service
    ) return []
    return [{ amount, service }]
  })
  options.sort((a, b) => {
    const aNormal = a.service === 'NORMAL' ? 0 : 1
    const bNormal = b.service === 'NORMAL' ? 0 : 1
    return aNormal - bNormal || a.amount - b.amount || a.service.localeCompare(b.service)
  })
  const selected = options[0]
  if (!selected) {
    throw new StarkenError('Starken no devolvió una tarifa a domicilio con cuenta corriente')
  }

  return {
    amountClp: selected.amount,
    serviceCode: selected.service,
    deliveryType: 'DOMICILIO',
    paymentType: 2,
    originCityCode,
    destinationCityCode,
  }
}
