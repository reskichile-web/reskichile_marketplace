import 'server-only'

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto'
import {
  isUuidV4,
  validatedAddressHash,
  type ValidatedHomeAddress,
} from './address'

interface SuggestionTokenPayload {
  type: 'suggestion'
  placeId: string
  sessionToken: string
  addressContext: string
  expiresAt: number
}

interface ValidatedAddressTokenPayload {
  type: 'validated-address'
  address: ValidatedHomeAddress
  addressHash: string
  addressContext: string
  expiresAt: number
}

const PLACE_ID_RE = /^[A-Za-z0-9_-]{8,255}$/
const TOKEN_TTL_MS = 20 * 60 * 1000
const SUGGESTION_TTL_MS = 10 * 60 * 1000

function key(secret: string): Buffer {
  return createHash('sha256').update('reski-address-token:v1:').update(secret).digest()
}

function seal(payload: object, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return ['a1', iv.toString('base64url'), ciphertext.toString('base64url'), tag.toString('base64url')].join('.')
}

function open(token: string, secret: string): Record<string, unknown> | null {
  if (token.length > 4096) return null
  const [version, ivRaw, ciphertextRaw, tagRaw, extra] = token.split('.')
  if (version !== 'a1' || !ivRaw || !ciphertextRaw || !tagRaw || extra) return null
  try {
    const iv = Buffer.from(ivRaw, 'base64url')
    const ciphertext = Buffer.from(ciphertextRaw, 'base64url')
    const tag = Buffer.from(tagRaw, 'base64url')
    if (
      iv.toString('base64url') !== ivRaw ||
      ciphertext.toString('base64url') !== ciphertextRaw ||
      tag.toString('base64url') !== tagRaw
    ) {
      return null
    }
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length < 16) return null
    const decipher = createDecipheriv('aes-256-gcm', key(secret), iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8')
    const parsed = JSON.parse(plaintext) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

export function createSuggestionToken(
  input: Omit<SuggestionTokenPayload, 'type' | 'expiresAt'>,
  secret: string,
  now = Date.now()
): string {
  return seal({ ...input, type: 'suggestion', expiresAt: now + SUGGESTION_TTL_MS }, secret)
}

export function readSuggestionToken(
  token: string,
  expected: { sessionToken: string; addressContext: string },
  secret: string,
  now = Date.now()
): SuggestionTokenPayload | null {
  const payload = open(token, secret)
  if (
    !payload ||
    payload.type !== 'suggestion' ||
    typeof payload.placeId !== 'string' ||
    !PLACE_ID_RE.test(payload.placeId) ||
    payload.sessionToken !== expected.sessionToken ||
    payload.addressContext !== expected.addressContext ||
    typeof payload.expiresAt !== 'number' ||
    payload.expiresAt <= now ||
    payload.expiresAt > now + SUGGESTION_TTL_MS
  ) {
    return null
  }
  return payload as unknown as SuggestionTokenPayload
}

export function createValidatedAddressToken(
  address: ValidatedHomeAddress,
  addressContext: string,
  secret: string,
  now = Date.now()
): string {
  return seal({
    type: 'validated-address',
    address,
    addressHash: validatedAddressHash(address),
    addressContext,
    expiresAt: now + TOKEN_TTL_MS,
  }, secret)
}

function isValidatedHomeAddress(value: unknown): value is ValidatedHomeAddress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const address = value as Partial<ValidatedHomeAddress>
  return (
    address.country_code === 'CL' &&
    address.provider === 'google' &&
    address.validation_status === 'confirmed' &&
    typeof address.region === 'string' && address.region.length >= 2 && address.region.length <= 100 &&
    typeof address.commune === 'string' && address.commune.length >= 2 && address.commune.length <= 100 &&
    typeof address.street === 'string' && address.street.length >= 2 && address.street.length <= 120 &&
    typeof address.number === 'string' && address.number.length >= 1 && address.number.length <= 20 &&
    typeof address.formatted_address === 'string' && address.formatted_address.length >= 5 && address.formatted_address.length <= 240 &&
    typeof address.provider_place_id === 'string' && PLACE_ID_RE.test(address.provider_place_id) &&
    typeof address.validated_at === 'string' && Number.isFinite(Date.parse(address.validated_at))
  )
}

export function readValidatedAddressToken(
  token: string,
  expectedAddressContext: string,
  secret: string,
  now = Date.now()
): ValidatedAddressTokenPayload | null {
  if (!isUuidV4(expectedAddressContext)) return null
  const payload = open(token, secret)
  if (
    !payload ||
    payload.type !== 'validated-address' ||
    payload.addressContext !== expectedAddressContext ||
    typeof payload.expiresAt !== 'number' ||
    payload.expiresAt <= now ||
    payload.expiresAt > now + TOKEN_TTL_MS ||
    !isValidatedHomeAddress(payload.address) ||
    payload.addressHash !== validatedAddressHash(payload.address)
  ) {
    return null
  }
  return payload as unknown as ValidatedAddressTokenPayload
}
