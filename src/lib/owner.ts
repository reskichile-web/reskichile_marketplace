// Site-owner contact info — used by the "Reclamar cuenta" prompt that
// appears on the home, catalog, and product pages.
//
// TODO: set OWNER_WHATSAPP to the site owner's WhatsApp number in
// international format (no "+", no spaces). Example: '56912345678'.
export const OWNER_WHATSAPP = '56912345678'

export const RECLAIM_LISTINGS_MESSAGE =
  'Hola! Tengo productos publicados a mi nombre en ReskiChile y quiero reclamar mi cuenta o crear una.'

export function reclaimListingsUrl(): string {
  return `https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(RECLAIM_LISTINGS_MESSAGE)}`
}
