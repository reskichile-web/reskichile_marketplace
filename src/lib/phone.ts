import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min'

export interface CountryOption {
  code: string // includes leading "+"
  iso2: CountryCode
  flag: string
  label: string
  // Maximum number of national digits accepted by the visible input.
  localLength: number
  validLocalLengths: readonly number[]
}

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: '+56', iso2: 'CL', flag: '🇨🇱', label: 'Chile', localLength: 9, validLocalLengths: [9] },
  { code: '+54', iso2: 'AR', flag: '🇦🇷', label: 'Argentina', localLength: 11, validLocalLengths: [10, 11] },
  { code: '+55', iso2: 'BR', flag: '🇧🇷', label: 'Brasil', localLength: 11, validLocalLengths: [10, 11] },
  { code: '+51', iso2: 'PE', flag: '🇵🇪', label: 'Perú', localLength: 9, validLocalLengths: [9] },
  { code: '+57', iso2: 'CO', flag: '🇨🇴', label: 'Colombia', localLength: 10, validLocalLengths: [10] },
  { code: '+52', iso2: 'MX', flag: '🇲🇽', label: 'México', localLength: 10, validLocalLengths: [10] },
  { code: '+1', iso2: 'US', flag: '🇺🇸', label: 'EEUU', localLength: 10, validLocalLengths: [10] },
  { code: '+34', iso2: 'ES', flag: '🇪🇸', label: 'España', localLength: 9, validLocalLengths: [9] },
]

export const DEFAULT_COUNTRY: CountryOption = COUNTRY_OPTIONS[0]

export function getCountryByCode(code: string): CountryOption | undefined {
  return COUNTRY_OPTIONS.find((c) => c.code === code)
}

export function getCountryByIso2(iso2: string): CountryOption | undefined {
  return COUNTRY_OPTIONS.find((country) => country.iso2 === iso2.toUpperCase())
}

/**
 * Extract local digits from any user input, given the selected country.
 * Handles the user pasting the +country prefix or country digits, double prefixes, spaces, dashes.
 *
 * Examples for +56:
 *  - "+56 9 1234 5678"  → "912345678"
 *  - "56 9 1234 5678"   → "912345678"
 *  - "9 1234 5678"      → "912345678"
 *  - "00569 1234 5678"  → "912345678"
 *  - "9-1234.5678"      → "912345678"
 */
export function parseLocalDigits(input: string, country: CountryOption): string {
  if (!input) return ''
  // Strip everything except digits
  let digits = input.replace(/\D/g, '')
  if (!digits) return ''

  // Strip leading 00 (international call prefix)
  if (digits.startsWith('00')) digits = digits.slice(2)

  // When pasted as an international value, remove the selected prefix before
  // clamping. This avoids turning "+56 9..." into a local number beginning 56.
  const ccDigits = country.code.replace('+', '')
  if (
    digits.startsWith(ccDigits) &&
    (input.trim().startsWith('+') || digits.length > country.localLength)
  ) {
    digits = digits.slice(ccDigits.length)
  }

  // Otherwise, just clamp to local length
  return digits.slice(0, country.localLength)
}

/**
 * Format local digits for display. Country-specific.
 * Default fallback groups every 4 digits.
 */
export function formatLocal(local: string, country: CountryOption): string {
  const d = local.replace(/\D/g, '').slice(0, country.localLength)
  if (country.code === '+56' && d.length > 0) {
    // Chile: 9 1234 5678
    if (d.length <= 1) return d
    if (d.length <= 5) return `${d[0]} ${d.slice(1)}`
    return `${d[0]} ${d.slice(1, 5)} ${d.slice(5)}`
  }
  if (country.code === '+1' && d.length > 0) {
    // US: (123) 456-7890
    if (d.length <= 3) return `(${d}`
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }
  // generic: groups of 4
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

/**
 * Build the full international number for storage: e.g. "+56912345678".
 */
export function toFullPhone(local: string, country: CountryOption): string {
  const d = local.replace(/\D/g, '').slice(0, country.localLength)
  if (!d) return ''
  return `${country.code}${d}`
}

/**
 * Parse a stored phone (e.g. "+56912345678" or "56912345678") into { country, local }.
 * If the country can't be determined, falls back to default and treats input as local.
 */
export function parseStoredPhone(stored: string | null | undefined): {
  country: CountryOption
  local: string
} {
  if (!stored) return { country: DEFAULT_COUNTRY, local: '' }
  // Strip everything except digits and the leading +
  const cleaned = stored.replace(/[^\d+]/g, '')
  const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned}`

  // Find the longest matching country code prefix
  const sorted = [...COUNTRY_OPTIONS].sort((a, b) => b.code.length - a.code.length)
  for (const c of sorted) {
    if (withPlus.startsWith(c.code)) {
      const rest = withPlus.slice(c.code.length).replace(/\D/g, '')
      // Only accept if the local portion length matches expected
      if (rest.length === c.localLength) {
        return { country: c, local: rest }
      }
      // Allow partial / over: clamp to localLength of that country
      if (rest.length > 0) {
        return { country: c, local: rest.slice(0, c.localLength) }
      }
    }
  }

  // Couldn't match a country code. Treat as default-country local.
  const localOnly = cleaned.replace(/\D/g, '').slice(-DEFAULT_COUNTRY.localLength)
  return { country: DEFAULT_COUNTRY, local: localOnly }
}

/**
 * Validate that local matches the expected length for the country.
 * Chile-specific: must start with 9.
 */
export function validateLocal(local: string, country: CountryOption): string | null {
  const d = local.replace(/\D/g, '')
  if (!country.validLocalLengths.includes(d.length)) {
    const expected = country.validLocalLengths.join(' u ')
    return `Debe tener ${expected} dígitos`
  }
  if (country.code === '+56' && !d.startsWith('9')) {
    return 'En Chile debe comenzar con 9'
  }
  if (!parseAndValidatePhone(`${country.code}${d}`, country.iso2)) {
    return `El número no es válido para ${country.label}`
  }
  return null
}

/**
 * Strict checkout boundary. The number must carry an explicit international
 * prefix, belong to one of the countries shown by PhoneInput and be valid for
 * the country selected by the buyer. The returned value is always E.164.
 */
export function parseAndValidatePhone(
  raw: string,
  expectedCountry?: string
): string | null {
  const value = raw.trim()
  if (
    !value.startsWith('+') ||
    value.length > 30 ||
    !/^\+[0-9\s().-]+$/.test(value)
  ) {
    return null
  }

  const selected = expectedCountry
    ? getCountryByIso2(expectedCountry)
    : undefined
  if (expectedCountry && !selected) return null

  const parsed = parsePhoneNumberFromString(value, selected?.iso2)
  if (!parsed?.isValid() || !parsed.country) return null

  const supported = getCountryByIso2(parsed.country)
  if (!supported || (selected && parsed.country !== selected.iso2)) return null
  if (`+${parsed.countryCallingCode}` !== supported.code) return null
  const national = parsed.nationalNumber.toString()
  if (!supported.validLocalLengths.includes(national.length)) return null
  if (supported.iso2 === 'CL' && !national.startsWith('9')) return null

  return parsed.number
}

/**
 * Coerce any stored phone variant to the canonical international format
 * "+<country><local>" (e.g. "+56912345678"). Handles legacy stores:
 *   "+56912345678"  → "+56912345678"  (already canonical)
 *   "56912345678"   → "+56912345678"  (missing leading +)
 *   "912345678"     → "+56912345678"  (missing country, assume Chile mobile)
 *   "9 1234 5678"   → "+56912345678"
 *   ""/null/junk    → null
 */
export function normalizeStoredPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = raw.replace(/[^\d+]/g, '')
  if (!cleaned) return null

  // Prefer strict normalization for countries supported by PhoneInput.
  if (cleaned.startsWith('+')) {
    const validated = parseAndValidatePhone(cleaned)
    if (validated) return validated
    const digits = cleaned.slice(1).replace(/\D/g, '')
    if (digits.length < 8 || digits.length > 15) return null
    return `+${digits}`
  }

  const digits = cleaned.replace(/\D/g, '')

  // International call prefix (00) → strip and treat as +.
  if (digits.startsWith('00')) {
    const rest = digits.slice(2)
    if (rest.length < 8 || rest.length > 15) return null
    return `+${rest}`
  }

  // Heuristic: if the digits start with a known country code AND total length
  // matches that country's expected total, treat as international without +.
  const sorted = [...COUNTRY_OPTIONS].sort((a, b) => b.code.length - a.code.length)
  for (const c of sorted) {
    const cc = c.code.replace('+', '')
    if (
      digits.startsWith(cc) &&
      c.validLocalLengths.includes(digits.length - cc.length)
    ) {
      return `+${digits}`
    }
  }

  // Looks like a bare Chilean mobile (9 + 8 digits) → assume +56.
  if (digits.length === DEFAULT_COUNTRY.localLength && digits.startsWith('9')) {
    return `+56${digits}`
  }

  // Anything else: no safe assumption.
  return null
}

/**
 * Build the WhatsApp-ready phone string from a stored value: digits only,
 * country code included, no leading "+". Returns null if the input can't be
 * normalized — caller should fall back (e.g. don't render the WhatsApp CTA).
 *
 *   "+56912345678" → "56912345678"
 *   "912345678"    → "56912345678"
 *   ""             → null
 */
export function phoneToWhatsApp(raw: string | null | undefined): string | null {
  const normalized = normalizeStoredPhone(raw)
  if (!normalized) return null
  return normalized.replace(/\D/g, '')
}

/**
 * Regex used by the DB CHECK constraint and any quick "is this string a
 * canonical phone?" check. Mirrors normalizeStoredPhone's output shape.
 */
export const CANONICAL_PHONE_REGEX = /^\+[0-9]{8,15}$/
