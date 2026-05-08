// Site-owner contact info — used by the "Reclamar cuenta" prompt that
// appears on the home, catalog, and product pages.
export const OWNER_WHATSAPP = '56964880714'

export const RECLAIM_LISTINGS_MESSAGE =
  'Hola! Subieron productos a mi nombre en ReskiChile y quiero asociarlos a mi cuenta.'

export function reclaimListingsUrl(): string {
  return `https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(RECLAIM_LISTINGS_MESSAGE)}`
}
