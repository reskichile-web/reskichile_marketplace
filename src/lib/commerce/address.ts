import { createHash } from 'crypto'
import { CHILE_REGIONS } from './regions'

export interface ValidatedHomeAddress {
  country_code: 'CL'
  region: string
  commune: string
  street: string
  number: string
  formatted_address: string
  provider: 'google'
  provider_place_id: string
  validation_status: 'confirmed'
  validated_at: string
}

export interface ShippingAddressSnapshot {
  country_code: 'CL'
  region: string
  commune: string
  street: string | null
  number: string | null
  extra: string | null
  formatted_address: string | null
  provider: 'google' | 'manual'
  provider_place_id: string | null
  validation_status: 'confirmed' | 'unverified' | 'not_required'
  validated_at: string | null
  pickup_point_id: string | null
}

export interface AddressSuggestion {
  id: string
  mainText: string
  secondaryText: string
  selectionToken: string
}

export interface AddressValidationSelection {
  address: ValidatedHomeAddress
  addressValidationToken: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuidV4(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

function comparable(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bregion\s+(?:de\s+|del\s+|de\s+la\s+)?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const REGION_ALIASES = new Map<string, string>()
for (const region of CHILE_REGIONS) {
  REGION_ALIASES.set(comparable(region), region)
}
REGION_ALIASES.set('metropolitana', 'Metropolitana de Santiago')
REGION_ALIASES.set('metropolitana santiago', 'Metropolitana de Santiago')
REGION_ALIASES.set('ohiggins', "Libertador General Bernardo O'Higgins")
REGION_ALIASES.set('libertador bernardo ohiggins', "Libertador General Bernardo O'Higgins")
REGION_ALIASES.set('aysen', 'Aysén del General Carlos Ibáñez del Campo')
REGION_ALIASES.set('magallanes', 'Magallanes y de la Antártica Chilena')

export function normalizeChileRegion(value: string): string | null {
  const normalized = comparable(value)
  const exact = REGION_ALIASES.get(normalized)
  if (exact) return exact

  for (const [alias, region] of REGION_ALIASES) {
    if (normalized.includes(alias) || alias.includes(normalized)) return region
  }
  return null
}

export function validatedAddressHash(address: ValidatedHomeAddress): string {
  const canonical = JSON.stringify({
    country_code: address.country_code,
    region: address.region,
    commune: address.commune,
    street: address.street,
    number: address.number,
    formatted_address: address.formatted_address,
    provider: address.provider,
    provider_place_id: address.provider_place_id,
    validation_status: address.validation_status,
  })
  return createHash('sha256').update(canonical).digest('hex')
}

export function manualShippingSnapshot(input: {
  region: string
  commune: string
  street: string | null
  number: string | null
  extra: string | null
  pickupPointId: string | null
}): ShippingAddressSnapshot {
  return {
    country_code: 'CL',
    region: input.region,
    commune: input.commune,
    street: input.street,
    number: input.number,
    extra: input.extra,
    formatted_address: null,
    provider: 'manual',
    provider_place_id: null,
    validation_status: input.pickupPointId ? 'not_required' : 'unverified',
    validated_at: null,
    pickup_point_id: input.pickupPointId,
  }
}
