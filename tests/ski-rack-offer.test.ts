import { describe, expect, it } from 'vitest'
import { skiRackOfferTimeRemaining, SKI_RACK_OFFER_ENDS_AT, SKI_RACK_OFFER_STARTS_AT } from '@/lib/ski-rack-offer'

describe('Seven-day rack offer countdown', () => {
  it('counts down to the fixed campaign deadline', () => {
    expect(skiRackOfferTimeRemaining(Date.parse('2026-10-21T22:34:59Z'))).toEqual({ totalMs: 1000, days: 0, hours: 0, minutes: 0, seconds: 1 })
  })
  it('runs for seven days shared by every visitor', () => {
    expect(Date.parse(SKI_RACK_OFFER_ENDS_AT) - Date.parse(SKI_RACK_OFFER_STARTS_AT)).toBe(7 * 86400 * 1000)
  })
  it('splits the remaining duration correctly', () => {
    const now = Date.parse(SKI_RACK_OFFER_ENDS_AT) - (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000
    expect(skiRackOfferTimeRemaining(now)).toMatchObject({ days: 2, hours: 3, minutes: 4, seconds: 5 })
  })
  it('stops at zero after the deadline', () => {
    expect(skiRackOfferTimeRemaining(Date.parse('2026-11-02T00:00:00Z'))).toEqual({ totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 })
  })
})
