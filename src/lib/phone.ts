export interface CountryOption {
  code: string // includes leading "+"
  flag: string
  label: string
  // Expected length of LOCAL digits (without country code)
  localLength: number
}

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: '+56', flag: '🇨🇱', label: 'Chile', localLength: 9 },
  { code: '+54', flag: '🇦🇷', label: 'Argentina', localLength: 10 },
  { code: '+55', flag: '🇧🇷', label: 'Brasil', localLength: 11 },
  { code: '+51', flag: '🇵🇪', label: 'Perú', localLength: 9 },
  { code: '+57', flag: '🇨🇴', label: 'Colombia', localLength: 10 },
  { code: '+52', flag: '🇲🇽', label: 'México', localLength: 10 },
  { code: '+1', flag: '🇺🇸', label: 'EEUU', localLength: 10 },
  { code: '+34', flag: '🇪🇸', label: 'España', localLength: 9 },
]

export const DEFAULT_COUNTRY: CountryOption = COUNTRY_OPTIONS[0]

export function getCountryByCode(code: string): CountryOption | undefined {
  return COUNTRY_OPTIONS.find((c) => c.code === code)
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

  // If it starts with the country code's digits AND total length suggests it includes the prefix, strip it
  const ccDigits = country.code.replace('+', '')
  if (
    digits.startsWith(ccDigits) &&
    digits.length === ccDigits.length + country.localLength
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
  if (d.length !== country.localLength) {
    return `Debe tener ${country.localLength} dígitos`
  }
  if (country.code === '+56' && !d.startsWith('9')) {
    return 'En Chile debe comenzar con 9'
  }
  return null
}
