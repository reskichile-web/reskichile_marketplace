import { describe, expect, it } from 'vitest'
import {
  COUNTRY_OPTIONS,
  parseAndValidatePhone,
  parseLocalDigits,
  validateLocal,
} from '@/lib/phone'

describe('strict phone parsing', () => {
  it.each([
    ['CL', '+56 9 1234 5678', '+56912345678'],
    ['AR', '+54 11 1234 5678', '+541112345678'],
    ['BR', '+55 11 98765 4321', '+5511987654321'],
    ['PE', '+51 987 654 321', '+51987654321'],
    ['CO', '+57 300 123 4567', '+573001234567'],
    ['MX', '+52 55 1234 5678', '+525512345678'],
    ['US', '+1 (202) 555-0123', '+12025550123'],
    ['ES', '+34 612 34 56 78', '+34612345678'],
  ])('normalizes a valid %s number to E.164', (country, raw, expected) => {
    expect(parseAndValidatePhone(raw, country)).toBe(expected)
  })

  it.each([
    ['CL', '+56812345678'],
    ['CL', '+5691234567'],
    ['CL', '+569123456789'],
    ['CL', '+56 9 1234 ABCD'],
    ['CL', '912345678'],
    ['US', '+56912345678'],
    ['ZZ', '+56912345678'],
  ])('rejects an invalid or inconsistent %s payload', (country, raw) => {
    expect(parseAndValidatePhone(raw, country)).toBeNull()
  })

  it('does not duplicate a country prefix pasted into the national field', () => {
    const chile = COUNTRY_OPTIONS.find((country) => country.iso2 === 'CL')!
    expect(parseLocalDigits('+56 9 1234 5678', chile)).toBe('912345678')
    expect(parseLocalDigits('00569 1234 5678', chile)).toBe('912345678')
    expect(validateLocal('912345678', chile)).toBeNull()
  })
})
