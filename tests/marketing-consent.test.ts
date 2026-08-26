import { describe, expect, it } from 'vitest'
import {
  MARKETING_CONSENT_MAX_AGE_MS,
  createMarketingConsentDecision,
  parseAccountMarketingConsent,
  parseMarketingConsent,
  parseStoredMarketingConsent,
  serializeMarketingConsent,
} from '@/lib/marketing-consent'

describe('marketing consent persistence', () => {
  it('round-trips a current decision', () => {
    const now = Date.UTC(2026, 7, 26)
    expect(parseMarketingConsent(serializeMarketingConsent('granted', now), now)).toBe('granted')
    expect(parseMarketingConsent(serializeMarketingConsent('denied', now), now)).toBe('denied')
    expect(parseStoredMarketingConsent(
      serializeMarketingConsent('granted', now, 'user-1'),
      now,
    )?.userId).toBe('user-1')
  })

  it('rejects malformed, future, and expired decisions', () => {
    const now = Date.UTC(2026, 7, 26)
    expect(parseMarketingConsent('not-json', now)).toBeNull()
    expect(parseMarketingConsent(JSON.stringify({ choice: 'maybe', version: 1, decidedAt: now }), now)).toBeNull()
    expect(parseMarketingConsent(JSON.stringify({ choice: 'granted', version: 0, decidedAt: now }), now)).toBeNull()
    expect(parseMarketingConsent(serializeMarketingConsent('granted', now + 1), now)).toBeNull()
    expect(parseMarketingConsent(
      serializeMarketingConsent('granted', now - MARKETING_CONSENT_MAX_AGE_MS - 1),
      now,
    )).toBeNull()
  })

  it('keeps a current-version account decision without the anonymous expiry', () => {
    const oldDecision = createMarketingConsentDecision(
      'denied',
      Date.now() - MARKETING_CONSENT_MAX_AGE_MS - 1,
    )

    expect(parseAccountMarketingConsent(oldDecision)).toEqual(oldDecision)
    expect(parseStoredMarketingConsent(JSON.stringify({
      ...oldDecision,
      userId: 'user-1',
    }))).toEqual({ ...oldDecision, userId: 'user-1' })
  })
})
