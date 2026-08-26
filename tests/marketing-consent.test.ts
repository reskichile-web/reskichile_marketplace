import { describe, expect, it } from 'vitest'
import {
  MARKETING_CONSENT_MAX_AGE_MS,
  parseMarketingConsent,
  serializeMarketingConsent,
} from '@/lib/marketing-consent'

describe('marketing consent persistence', () => {
  it('round-trips a current decision', () => {
    const now = Date.UTC(2026, 7, 26)
    expect(parseMarketingConsent(serializeMarketingConsent('granted', now), now)).toBe('granted')
    expect(parseMarketingConsent(serializeMarketingConsent('denied', now), now)).toBe('denied')
  })

  it('rejects malformed, future, and expired decisions', () => {
    const now = Date.UTC(2026, 7, 26)
    expect(parseMarketingConsent('not-json', now)).toBeNull()
    expect(parseMarketingConsent(JSON.stringify({ choice: 'maybe', decidedAt: now }), now)).toBeNull()
    expect(parseMarketingConsent(serializeMarketingConsent('granted', now + 1), now)).toBeNull()
    expect(parseMarketingConsent(
      serializeMarketingConsent('granted', now - MARKETING_CONSENT_MAX_AGE_MS - 1),
      now,
    )).toBeNull()
  })
})
