import 'server-only'

import { createHash } from 'crypto'
import type { AddressConfig } from '@/lib/env/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isTrustedCheckoutOrigin } from './checkout-origin'
import {
  createSuggestionToken,
  createValidatedAddressToken,
  readSuggestionToken,
  readValidatedAddressToken,
} from './address-token'
import { isUuidV4, type AddressSuggestion, type AddressValidationSelection } from './address'
import type { CheckoutInput } from './checkout-validation'
import {
  AddressProviderError,
  googleAutocomplete,
  googleValidatePlace,
} from './google-address-provider'

export class AddressServiceError extends Error {
  status: number
  code: string
  publicMessage: string

  constructor(code: string, publicMessage: string, status: number, internal?: string) {
    super(internal || publicMessage)
    this.name = 'AddressServiceError'
    this.code = code
    this.publicMessage = publicMessage
    this.status = status
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AddressServiceError('INVALID_INPUT', 'La solicitud de dirección no es válida.', 422)
  }
  return value as Record<string, unknown>
}

function providerError(error: unknown): AddressServiceError {
  if (error instanceof AddressProviderError) {
    return new AddressServiceError(
      'ADDRESS_PROVIDER_UNAVAILABLE',
      'No pudimos validar direcciones en este momento. Inténtalo nuevamente.',
      error.retryable ? 503 : 502,
      error.message
    )
  }
  return new AddressServiceError(
    'ADDRESS_PROVIDER_UNAVAILABLE',
    'No pudimos validar direcciones en este momento. Inténtalo nuevamente.',
    503
  )
}

function assertEnabled(config: AddressConfig): asserts config is AddressConfig & {
  signingSecret: string
  rateLimitSecret: string
} {
  if (!config.enabled || !config.signingSecret || !config.rateLimitSecret) {
    throw new AddressServiceError(
      'ADDRESS_VALIDATION_DISABLED',
      'La validación de dirección todavía no está disponible.',
      503
    )
  }
}

export function assertTrustedAddressRequest(config: AddressConfig, request: Request): void {
  if (!isTrustedCheckoutOrigin(config.appUrl, request)) {
    throw new AddressServiceError(
      'INVALID_ORIGIN',
      'La solicitud no tiene un origen permitido.',
      403
    )
  }
  const mediaType = (request.headers.get('content-type') || '')
    .split(';', 1)[0]?.trim().toLowerCase()
  if (mediaType !== 'application/json') {
    throw new AddressServiceError('INVALID_CONTENT_TYPE', 'El formato de la solicitud no es válido.', 415)
  }
}

export async function readAddressJson(request: Request): Promise<unknown> {
  const maximumBytes = 8192
  const contentLength = Number(request.headers.get('content-length') || '0')
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new AddressServiceError('BODY_TOO_LARGE', 'La solicitud es demasiado grande.', 413)
  }
  if (!request.body) {
    throw new AddressServiceError('INVALID_JSON', 'La solicitud no contiene JSON válido.', 400)
  }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  while (true) {
    const part = await reader.read()
    if (part.done) break
    received += part.value.byteLength
    if (received > maximumBytes) {
      await reader.cancel()
      throw new AddressServiceError('BODY_TOO_LARGE', 'La solicitud es demasiado grande.', 413)
    }
    chunks.push(part.value)
  }
  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
  } catch {
    throw new AddressServiceError('INVALID_JSON', 'La solicitud no contiene JSON válido.', 400)
  }
}

async function consumeRateLimit(
  config: AddressConfig & { rateLimitSecret: string },
  request: Request,
  scope: 'autocomplete' | 'validate',
  sessionToken: string
): Promise<void> {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = (forwarded?.split(',', 1)[0] || request.headers.get('x-real-ip') || 'unknown')
    .trim().slice(0, 64)
  const supabase = createServiceRoleClient()
  const buckets = [
    {
      kind: 'ip',
      value: ip,
      limit: scope === 'autocomplete' ? 120 : 30,
    },
    {
      kind: 'session',
      value: sessionToken,
      limit: scope === 'autocomplete' ? 60 : 15,
    },
  ] as const

  for (const bucket of buckets) {
    const keyHash = createHash('sha256')
      .update(config.rateLimitSecret)
      .update(`:address:${scope}:${bucket.kind}:${bucket.value}`)
      .digest('hex')
    const { data, error } = await supabase.rpc('commerce_consume_rate_limit', {
      p_key_hash: keyHash,
      p_window_seconds: 3600,
      p_limit: bucket.limit,
    })
    if (error) {
      throw new AddressServiceError('RATE_LIMIT_ERROR', 'No pudimos validar la dirección.', 503)
    }
    if (data !== true) {
      throw new AddressServiceError('RATE_LIMITED', 'Demasiados intentos. Espera antes de continuar.', 429)
    }
  }
}

export async function autocompleteAddress(
  config: AddressConfig,
  request: Request,
  raw: unknown
): Promise<{ suggestions: AddressSuggestion[] }> {
  assertEnabled(config)
  const input = objectValue(raw)
  const query = typeof input.query === 'string'
    ? input.query.trim().replace(/\s+/g, ' ')
    : ''
  if (query.length < 3 || query.length > 120 || !isUuidV4(input.sessionToken) || !isUuidV4(input.addressContext)) {
    throw new AddressServiceError('INVALID_INPUT', 'La búsqueda de dirección no es válida.', 422)
  }
  await consumeRateLimit(config, request, 'autocomplete', input.sessionToken)
  try {
    const predictions = await googleAutocomplete(config, query, input.sessionToken)
    return {
      suggestions: predictions.map((prediction) => ({
        id: createHash('sha256').update(prediction.placeId).digest('hex').slice(0, 16),
        mainText: prediction.mainText,
        secondaryText: prediction.secondaryText,
        selectionToken: createSuggestionToken({
          placeId: prediction.placeId,
          sessionToken: input.sessionToken as string,
          addressContext: input.addressContext as string,
        }, config.signingSecret),
      })),
    }
  } catch (error) {
    throw providerError(error)
  }
}

export async function validateAddressSelection(
  config: AddressConfig,
  request: Request,
  raw: unknown
): Promise<AddressValidationSelection> {
  assertEnabled(config)
  const input = objectValue(raw)
  if (
    typeof input.selectionToken !== 'string' ||
    !isUuidV4(input.sessionToken) ||
    !isUuidV4(input.addressContext)
  ) {
    throw new AddressServiceError('INVALID_INPUT', 'La selección de dirección no es válida.', 422)
  }
  const selection = readSuggestionToken(input.selectionToken, {
    sessionToken: input.sessionToken,
    addressContext: input.addressContext,
  }, config.signingSecret)
  if (!selection) {
    throw new AddressServiceError('INVALID_SELECTION', 'La selección de dirección venció. Búscala nuevamente.', 422)
  }
  await consumeRateLimit(config, request, 'validate', input.sessionToken)
  try {
    const address = await googleValidatePlace(config, selection.placeId, input.sessionToken)
    if (!address) {
      throw new AddressServiceError(
        'ADDRESS_NOT_CONFIRMED',
        'No pudimos confirmar calle y número. Corrige la dirección e inténtalo nuevamente.',
        422
      )
    }
    return {
      address,
      addressValidationToken: createValidatedAddressToken(
        address,
        input.addressContext,
        config.signingSecret
      ),
    }
  } catch (error) {
    if (error instanceof AddressServiceError) throw error
    throw providerError(error)
  }
}

export function verifyCheckoutShippingAddress(
  config: AddressConfig,
  input: CheckoutInput
): CheckoutInput {
  if (input.delivery.method === 'pickup' || !config.enabled) return input
  assertEnabled(config)

  const context = input.delivery.addressContext
  const token = input.delivery.addressValidationToken
  if (!context || !token) {
    throw new AddressServiceError(
      'ADDRESS_VALIDATION_REQUIRED',
      'Busca y confirma la dirección antes de continuar.',
      422
    )
  }
  const validated = readValidatedAddressToken(
    token,
    context,
    config.signingSecret
  )
  if (!validated) {
    throw new AddressServiceError(
      'ADDRESS_VALIDATION_EXPIRED',
      'La validación de dirección venció. Búscala nuevamente.',
      422
    )
  }
  const address = validated.address
  if (
    address.region !== input.delivery.region ||
    address.commune !== input.delivery.commune ||
    address.street !== input.delivery.street ||
    address.number !== input.delivery.number
  ) {
    throw new AddressServiceError(
      'ADDRESS_CHANGED',
      'La dirección cambió después de validarla. Búscala nuevamente.',
      422
    )
  }

  return {
    ...input,
    delivery: {
      ...input.delivery,
      shippingSnapshot: {
        ...address,
        extra: input.delivery.extra,
        pickup_point_id: null,
      },
    },
  }
}
