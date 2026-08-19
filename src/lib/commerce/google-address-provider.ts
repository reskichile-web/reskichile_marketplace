import 'server-only'

import type { AddressConfig } from '@/lib/env/server'
import {
  normalizeChileRegion,
  type ValidatedHomeAddress,
} from './address'

interface GoogleAutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string
      text?: { text?: string }
      structuredFormat?: {
        mainText?: { text?: string }
        secondaryText?: { text?: string }
      }
    }
  }>
}

interface GoogleAddressComponent {
  componentName?: { text?: string }
  componentType?: string
  confirmationLevel?: string
  unexpected?: boolean
}

interface GoogleValidationResponse {
  result?: {
    verdict?: {
      validationGranularity?: string
      addressComplete?: boolean
      hasUnconfirmedComponents?: boolean
    }
    address?: {
      formattedAddress?: string
      postalAddress?: {
        regionCode?: string
        administrativeArea?: string
        locality?: string
      }
      addressComponents?: GoogleAddressComponent[]
      missingComponentTypes?: string[]
    }
  }
}

export interface GoogleAddressPrediction {
  placeId: string
  mainText: string
  secondaryText: string
}

export class AddressProviderError extends Error {
  retryable: boolean

  constructor(message: string, retryable = true) {
    super(message)
    this.name = 'AddressProviderError'
    this.retryable = retryable
  }
}

const PLACE_ID_RE = /^[A-Za-z0-9_-]{8,255}$/
let consecutiveFailures = 0
let circuitOpenUntil = 0

async function googleJson(
  config: AddressConfig,
  url: string,
  init: RequestInit,
  fieldMask?: string
): Promise<unknown> {
  if (!config.googleMapsServerApiKey) {
    throw new AddressProviderError('address provider is not configured', false)
  }
  if (circuitOpenUntil > Date.now()) {
    throw new AddressProviderError('address provider circuit is open')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.googleMapsServerApiKey,
        ...(fieldMask ? { 'X-Goog-FieldMask': fieldMask } : {}),
        ...init.headers,
      },
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new AddressProviderError(`address provider HTTP ${response.status}`, response.status >= 500 || response.status === 429)
    }
    const result = await response.json() as unknown
    consecutiveFailures = 0
    return result
  } catch (error) {
    consecutiveFailures += 1
    if (consecutiveFailures >= 3) {
      circuitOpenUntil = Date.now() + 30_000
      consecutiveFailures = 0
    }
    if (error instanceof AddressProviderError) throw error
    throw new AddressProviderError(
      error instanceof Error && error.name === 'AbortError'
        ? 'address provider timeout'
        : 'address provider request failed'
    )
  } finally {
    clearTimeout(timeout)
  }
}

function shortText(value: unknown, maximum: number): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized && normalized.length <= maximum ? normalized : null
}

export async function googleAutocomplete(
  config: AddressConfig,
  input: string,
  sessionToken: string
): Promise<GoogleAddressPrediction[]> {
  const raw = await googleJson(
    config,
    'https://places.googleapis.com/v1/places:autocomplete',
    {
      method: 'POST',
      body: JSON.stringify({
        input,
        includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
        includedRegionCodes: ['cl'],
        languageCode: 'es',
        regionCode: 'CL',
        sessionToken,
        includeQueryPredictions: false,
      }),
    },
    [
      'suggestions.placePrediction.placeId',
      'suggestions.placePrediction.text.text',
      'suggestions.placePrediction.structuredFormat.mainText.text',
      'suggestions.placePrediction.structuredFormat.secondaryText.text',
    ].join(',')
  ) as GoogleAutocompleteResponse

  return (raw.suggestions || []).flatMap((suggestion) => {
    const prediction = suggestion.placePrediction
    const placeId = prediction?.placeId
    const full = shortText(prediction?.text?.text, 240)
    const mainText = shortText(prediction?.structuredFormat?.mainText?.text, 160) || full
    const secondaryText = shortText(prediction?.structuredFormat?.secondaryText?.text, 200) || ''
    if (!placeId || !PLACE_ID_RE.test(placeId) || !mainText) return []
    return [{ placeId, mainText, secondaryText }]
  }).slice(0, 5)
}

function confirmedComponent(
  components: GoogleAddressComponent[],
  types: readonly string[],
  maximum: number
): string | null {
  for (const type of types) {
    const component = components.find((candidate) => candidate.componentType === type)
    const text = shortText(component?.componentName?.text, maximum)
    if (
      text &&
      component?.confirmationLevel === 'CONFIRMED' &&
      component.unexpected !== true
    ) {
      return text
    }
  }
  return null
}

export function validatedAddressFromGoogle(
  placeId: string,
  response: unknown,
  now = new Date()
): ValidatedHomeAddress | null {
  if (!PLACE_ID_RE.test(placeId) || !response || typeof response !== 'object') return null
  const raw = response as GoogleValidationResponse
  const result = raw.result
  const verdict = result?.verdict
  const address = result?.address
  const components = address?.addressComponents || []
  const missing = new Set(address?.missingComponentTypes || [])

  if (
    verdict?.addressComplete !== true ||
    !['PREMISE', 'SUB_PREMISE'].includes(verdict.validationGranularity || '') ||
    verdict.hasUnconfirmedComponents === true ||
    address?.postalAddress?.regionCode !== 'CL' ||
    missing.has('street_number') ||
    missing.has('route')
  ) {
    return null
  }

  const regionRaw = confirmedComponent(
    components,
    ['administrative_area_level_1'],
    100
  ) || shortText(address?.postalAddress?.administrativeArea, 100)
  const commune = confirmedComponent(
    components,
    ['administrative_area_level_3', 'locality', 'administrative_area_level_2'],
    100
  ) || shortText(address?.postalAddress?.locality, 100)
  const street = confirmedComponent(components, ['route'], 120)
  const number = confirmedComponent(components, ['street_number'], 20)
  const formattedAddress = shortText(address?.formattedAddress, 240)
  const region = regionRaw ? normalizeChileRegion(regionRaw) : null

  if (!region || !commune || !street || !number || !formattedAddress) return null

  return {
    country_code: 'CL',
    region,
    commune,
    street,
    number,
    formatted_address: formattedAddress,
    provider: 'google',
    provider_place_id: placeId,
    validation_status: 'confirmed',
    validated_at: now.toISOString(),
  }
}

export async function googleValidatePlace(
  config: AddressConfig,
  placeId: string,
  sessionToken: string
): Promise<ValidatedHomeAddress | null> {
  if (!PLACE_ID_RE.test(placeId)) return null
  const detailsUrl = new URL(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`
  )
  detailsUrl.searchParams.set('languageCode', 'es')
  detailsUrl.searchParams.set('regionCode', 'CL')
  detailsUrl.searchParams.set('sessionToken', sessionToken)
  const details = await googleJson(
    config,
    detailsUrl.toString(),
    { method: 'GET' },
    'id,formattedAddress'
  ) as { id?: string; formattedAddress?: string }
  const formattedAddress = shortText(details.formattedAddress, 240)
  if (details.id !== placeId || !formattedAddress) return null

  const validated = await googleJson(
    config,
    'https://addressvalidation.googleapis.com/v1:validateAddress',
    {
      method: 'POST',
      body: JSON.stringify({
        address: {
          regionCode: 'CL',
          languageCode: 'es',
          addressLines: [formattedAddress],
        },
      }),
    }
  )
  return validatedAddressFromGoogle(placeId, validated)
}
