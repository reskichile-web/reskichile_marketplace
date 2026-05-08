// Site-owner contact info — used by the "Reclamar cuenta" prompt that
// appears on the home, catalog, and product pages.
export const OWNER_WHATSAPP = '56964880714'

export const RECLAIM_LISTINGS_MESSAGE =
  'Hola! Reski publicó un producto mío en ReskiChile y quiero crear/vincularlo a mi cuenta.'

export function reclaimListingsUrl(): string {
  return `https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(RECLAIM_LISTINGS_MESSAGE)}`
}
