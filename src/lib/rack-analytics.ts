export const RACK_EVENTS = {
  cartAdd: 'rack_cart_add',
  cartRemove: 'rack_cart_remove',
  cartQuantity: 'rack_cart_quantity',
  cartClear: 'rack_cart_clear',
  cartOpen: 'rack_cart_open',
  checkoutView: 'rack_checkout_view',
  checkoutContact: 'rack_checkout_contact',
  checkoutShipping: 'rack_checkout_shipping',
  paymentStart: 'rack_payment_start',
  purchase: 'rack_purchase',
} as const

export type RackEventName = (typeof RACK_EVENTS)[keyof typeof RACK_EVENTS]

export const RACK_EVENT_LABELS: Record<string, string> = {
  rack_catalog_view: 'Vio el catálogo de Ski Racks',
  rack_product_view: 'Vio un Ski Rack',
  rack_cart_page_view: 'Vio la página del carrito',
  [RACK_EVENTS.cartAdd]: 'Agregó al carrito',
  [RACK_EVENTS.cartRemove]: 'Quitó del carrito',
  [RACK_EVENTS.cartQuantity]: 'Cambió la cantidad',
  [RACK_EVENTS.cartClear]: 'Vació el carrito',
  [RACK_EVENTS.cartOpen]: 'Abrió el carrito',
  [RACK_EVENTS.checkoutView]: 'Entró al checkout',
  [RACK_EVENTS.checkoutContact]: 'Completó sus datos',
  [RACK_EVENTS.checkoutShipping]: 'Cotizó el despacho',
  [RACK_EVENTS.paymentStart]: 'Fue a pagar con Webpay',
  [RACK_EVENTS.purchase]: 'Compra confirmada',
}

function safePart(value: string | number): string {
  return String(value).replace(/[;=]/g, '').slice(0, 48)
}

/** Compact, human-readable metadata that fits the events.category column. */
export function rackEventDetail(
  fields: Record<string, string | number | null | undefined>
): string {
  return Object.entries(fields)
    .filter((entry): entry is [string, string | number] => entry[1] !== null && entry[1] !== undefined)
    .map(([key, value]) => `${safePart(key)}=${safePart(value)}`)
    .join(';')
    .slice(0, 100)
}

export function parseRackEventDetail(value: string | null | undefined): Record<string, string> {
  if (!value) return {}
  return Object.fromEntries(
    value.split(';').flatMap(part => {
      const separator = part.indexOf('=')
      if (separator <= 0) return []
      return [[part.slice(0, separator), part.slice(separator + 1)]]
    })
  )
}
