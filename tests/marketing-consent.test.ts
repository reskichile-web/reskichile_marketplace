import { describe, expect, it } from 'vitest'
import {
  MARKETING_CONSENT_MAX_AGE_MS,
  createMarketingConsentDecision,
  parseAccountMarketingConsent,
  parseMarketingConsent,
  parseStoredMarketingConsent,
  resolveMarketingConsentDecision,
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

  it('keeps the device choice when the signed-in identity changes', () => {
    const localDecision = {
      ...createMarketingConsentDecision('granted', 100),
      userId: 'previous-user',
    }
    const accountDecision = createMarketingConsentDecision('denied', 200)

    expect(resolveMarketingConsentDecision(localDecision, accountDecision)).toEqual(localDecision)
    expect(resolveMarketingConsentDecision(localDecision, null)).toEqual(localDecision)
  })

  it('uses the account only when the device has no stored choice', () => {
    const accountDecision = createMarketingConsentDecision('granted', 100)

    expect(resolveMarketingConsentDecision(null, accountDecision)).toEqual(accountDecision)
    expect(resolveMarketingConsentDecision(null, null)).toBeNull()
  })
})
