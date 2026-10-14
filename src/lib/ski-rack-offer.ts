// One shared seven-day campaign: October 14–21, 19:35 America/Santiago.
export const SKI_RACK_OFFER_STARTS_AT = '2026-10-14T22:35:00.000Z'
export const SKI_RACK_OFFER_ENDS_AT = '2026-10-21T22:35:00.000Z'
export const SKI_RACK_OFFER_PRICE_CLP = 13490
export const SKI_RACK_REGULAR_PRICE_CLP = 17990

export function skiRackOfferTimeRemaining(now: number) {
  const totalMs = Math.max(0, Date.parse(SKI_RACK_OFFER_ENDS_AT) - now)
  const seconds = Math.floor(totalMs / 1000)
  return {
    totalMs,
    days: Math.floor(seconds / 86400),
    hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
  }
}
