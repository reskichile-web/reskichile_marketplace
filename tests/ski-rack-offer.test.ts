import { describe, expect, it } from 'vitest'
import { skiRackOfferTimeRemaining, SKI_RACK_OFFER_ENDS_AT } from '@/lib/ski-rack-offer'

describe('Rack offer countdown through October 30', () => {
  it('counts down through the last second of October 30 in Chile', () => {
    expect(skiRackOfferTimeRemaining(Date.parse('2026-10-30T23:59:59-03:00'))).toEqual({ totalMs: 1000, days: 0, hours: 0, minutes: 0, seconds: 1 })
  })
  it('keeps the offer active after the previous deadline', () => {
    expect(skiRackOfferTimeRemaining(Date.parse('2026-10-22T00:00:00-03:00'))).toEqual({ totalMs: 9 * 86400 * 1000, days: 9, hours: 0, minutes: 0, seconds: 0 })
  })
  it('ends at midnight on October 31 in Chile', () => {
    expect(skiRackOfferTimeRemaining(Date.parse('2026-10-31T00:00:00-03:00'))).toEqual({ totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 })
  })
  it('splits the remaining duration correctly', () => {
    const now = Date.parse(SKI_RACK_OFFER_ENDS_AT) - (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000
    expect(skiRackOfferTimeRemaining(now)).toMatchObject({ days: 2, hours: 3, minutes: 4, seconds: 5 })
  })
  it('stops at zero after the deadline', () => {
    expect(skiRackOfferTimeRemaining(Date.parse('2026-11-02T00:00:00Z'))).toEqual({ totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 })
  })
})
