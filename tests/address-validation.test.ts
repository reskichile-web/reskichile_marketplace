import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createSuggestionToken,
  createValidatedAddressToken,
  readSuggestionToken,
  readValidatedAddressToken,
} from '@/lib/commerce/address-token'
import {
  normalizeChileRegion,
  validatedAddressHash,
  type ValidatedHomeAddress,
} from '@/lib/commerce/address'
import {
  googleAutocomplete,
  validatedAddressFromGoogle,
} from '@/lib/commerce/google-address-provider'
import type { AddressConfig } from '@/lib/env/server'
import { parseCheckoutInput } from '@/lib/commerce/checkout-validation'
import {
  AddressServiceError,
  verifyCheckoutShippingAddress,
} from '@/lib/commerce/address-service'

const secret = 'address-signing-secret-'.padEnd(48, 'x')
const sessionToken = '10000000-0000-4000-8000-000000000001'
const addressContext = '20000000-0000-4000-8000-000000000002'
const placeId = 'ChIJAddressExample123456789'
const now = new Date('2026-08-19T12:00:00.000Z')

const address: ValidatedHomeAddress = {
  country_code: 'CL',
  region: 'Metropolitana de Santiago',
  commune: 'Las Condes',
  street: 'Avenida Apoquindo',
  number: '3000',
  formatted_address: 'Avenida Apoquindo 3000, Las Condes, Chile',
  provider: 'google',
  provider_place_id: placeId,
  validation_status: 'confirmed',
  validated_at: now.toISOString(),
}

function googleResponse(overrides: Record<string, unknown> = {}) {
  return {
    result: {
      verdict: {
        validationGranularity: 'PREMISE',
        addressComplete: true,
        hasUnconfirmedComponents: false,
      },
      address: {
        formattedAddress: address.formatted_address,
        postalAddress: {
          regionCode: 'CL',
          administrativeArea: 'Región Metropolitana de Santiago',
          locality: 'Las Condes',
        },
        addressComponents: [
          { componentName: { text: 'Avenida Apoquindo' }, componentType: 'route', confirmationLevel: 'CONFIRMED' },
          { componentName: { text: '3000' }, componentType: 'street_number', confirmationLevel: 'CONFIRMED' },
          { componentName: { text: 'Las Condes' }, componentType: 'administrative_area_level_3', confirmationLevel: 'CONFIRMED' },
          { componentName: { text: 'Región Metropolitana' }, componentType: 'administrative_area_level_1', confirmationLevel: 'CONFIRMED' },
        ],
        missingComponentTypes: [],
      },
      ...overrides,
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('opaque address tokens', () => {
  it('binds a suggestion to its session and checkout context', () => {
    const token = createSuggestionToken({ placeId, sessionToken, addressContext }, secret, now.getTime())
    expect(token).not.toContain(placeId)
    expect(readSuggestionToken(token, { sessionToken, addressContext }, secret, now.getTime())).toMatchObject({ placeId })
    expect(readSuggestionToken(token, { sessionToken, addressContext: sessionToken }, secret, now.getTime())).toBeNull()
    expect(readSuggestionToken(token, { sessionToken, addressContext }, secret, now.getTime() + 10 * 60 * 1000 + 1)).toBeNull()
  })

  it('detects tampering, expiration and address/context substitution', () => {
    const token = createValidatedAddressToken(address, addressContext, secret, now.getTime())
    expect(token).not.toContain('Apoquindo')
    expect(readValidatedAddressToken(token, addressContext, secret, now.getTime())).toMatchObject({
      address,
      addressHash: validatedAddressHash(address),
    })
    expect(readValidatedAddressToken(`${token.slice(0, -1)}x`, addressContext, secret, now.getTime())).toBeNull()
    expect(readValidatedAddressToken(token, sessionToken, secret, now.getTime())).toBeNull()
    expect(readValidatedAddressToken(token, addressContext, secret, now.getTime() + 20 * 60 * 1000 + 1)).toBeNull()
  })

  it('binds quote/create fields to the validated snapshot', () => {
    const currentAddress = { ...address, validated_at: new Date().toISOString() }
    const token = createValidatedAddressToken(currentAddress, addressContext, secret)
    const raw = {
      productIds: [],
      rackItems: [{ slug: 'madera', size: 'S', quantity: 1 }],
      idempotencyKey: '30000000-0000-4000-8000-000000000003',
      buyer: {
        name: 'Ana Pérez',
        email: 'ana@example.com',
        phone: '+56912345678',
        phoneCountry: 'CL',
      },
      delivery: {
        method: 'home',
        region: currentAddress.region,
        commune: currentAddress.commune,
        street: currentAddress.street,
        number: currentAddress.number,
        extra: 'Depto. 42',
        pickupPointId: null,
        addressContext,
        addressValidationToken: token,
      },
      couponCode: null,
    }
    const config: AddressConfig = {
      enabled: true,
      provider: 'google',
      appUrl: new URL('https://sandbox.reskichile.cl'),
      googleMapsServerApiKey: 'g'.repeat(32),
      signingSecret: secret,
      rateLimitSecret: 'r'.repeat(32),
      timeoutMs: 1000,
    }
    expect(verifyCheckoutShippingAddress(config, parseCheckoutInput(raw)).delivery.shippingSnapshot).toEqual({
      ...currentAddress,
      extra: 'Depto. 42',
      pickup_point_id: null,
    })
    expect(() => verifyCheckoutShippingAddress(config, parseCheckoutInput({
      ...raw,
      delivery: { ...raw.delivery, street: 'Otra calle' },
    }))).toThrow(AddressServiceError)
    expect(() => verifyCheckoutShippingAddress(config, parseCheckoutInput({
      ...raw,
      delivery: { ...raw.delivery, addressValidationToken: null },
    }))).toThrow('Busca y confirma')
  })
})

describe('Google response minimization', () => {
  it('extracts only a confirmed Chilean premise snapshot', () => {
    expect(validatedAddressFromGoogle(placeId, googleResponse(), now)).toEqual(address)
  })

  it('rejects route-level, incomplete and unconfirmed addresses', () => {
    expect(validatedAddressFromGoogle(placeId, googleResponse({
      verdict: { validationGranularity: 'ROUTE', addressComplete: true },
    }), now)).toBeNull()
    expect(validatedAddressFromGoogle(placeId, googleResponse({
      verdict: { validationGranularity: 'PREMISE', addressComplete: false },
    }), now)).toBeNull()
    expect(validatedAddressFromGoogle(placeId, googleResponse({
      verdict: { validationGranularity: 'PREMISE', addressComplete: true, hasUnconfirmedComponents: true },
    }), now)).toBeNull()
  })

  it.each([
    ['Región Metropolitana', 'Metropolitana de Santiago'],
    ["Región del Libertador General Bernardo O'Higgins", "Libertador General Bernardo O'Higgins"],
    ['Región de Aysén', 'Aysén del General Carlos Ibáñez del Campo'],
  ])('maps provider region %s to the canonical checkout value', (provider, canonical) => {
    expect(normalizeChileRegion(provider)).toBe(canonical)
  })

  it('sends a Chile-only, field-masked autocomplete request and minimizes output', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      suggestions: [{
        placePrediction: {
          placeId,
          text: { text: 'Avenida Apoquindo 3000, Las Condes, Chile' },
          structuredFormat: {
            mainText: { text: 'Avenida Apoquindo 3000' },
            secondaryText: { text: 'Las Condes, Chile' },
          },
          distanceMeters: 123,
        },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const config: AddressConfig = {
      enabled: true,
      provider: 'google',
      appUrl: new URL('https://sandbox.reskichile.cl'),
      googleMapsServerApiKey: 'g'.repeat(32),
      signingSecret: secret,
      rateLimitSecret: 'r'.repeat(32),
      timeoutMs: 1000,
    }

    await expect(googleAutocomplete(config, 'Apoquindo 3000', sessionToken)).resolves.toEqual([{
      placeId,
      mainText: 'Avenida Apoquindo 3000',
      secondaryText: 'Las Condes, Chile',
    }])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete')
    expect(JSON.parse(String(init?.body))).toMatchObject({
      includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
      includedRegionCodes: ['cl'],
      languageCode: 'es',
      regionCode: 'CL',
      sessionToken,
    })
    expect(new Headers(init?.headers).get('X-Goog-FieldMask')).not.toContain('*')
  })
})
