import 'server-only'

import { createHash } from 'crypto'
import { normalizeStoredPhone } from '@/lib/phone'
import { CHILE_REGIONS } from './regions'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const COUPON_RE = /^[A-Z0-9-]{3,32}$/

export type DeliveryMethod = 'home' | 'pickup'

export interface RackCheckoutItem {
  slug: string
  size: 'S' | 'M' | 'L'
  quantity: number
}

export interface CheckoutInput {
  productIds: string[]
  rackItems: RackCheckoutItem[]
  idempotencyKey: string
  buyer: {
    name: string
    email: string
    phone: string
  }
  delivery: {
    method: DeliveryMethod
    region: string
    commune: string
    street: string | null
    number: string | null
    extra: string | null
    pickupPointId: string | null
  }
  couponCode: string | null
}

export class CheckoutValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CheckoutValidationError'
  }
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CheckoutValidationError(label + ' no es válido')
  }
  return value as Record<string, unknown>
}

function stringValue(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number
): string {
  if (typeof value !== 'string') {
    throw new CheckoutValidationError(label + ' no es válido')
  }

  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new CheckoutValidationError(label + ' no es válido')
  }
  return normalized
}

function optionalString(
  value: unknown,
  label: string,
  maximum: number
): string | null {
  if (value == null || value === '') return null
  return stringValue(value, label, 1, maximum)
}

export function parseCheckoutInput(raw: unknown): CheckoutInput {
  const root = objectValue(raw, 'Solicitud')
  const buyer = objectValue(root.buyer, 'Comprador')
  const delivery = objectValue(root.delivery, 'Despacho')

  const rawProductIds = Array.isArray(root.productIds) ? root.productIds : []
  const rawRackItems = Array.isArray(root.rackItems) ? root.rackItems : []
  const hasProducts = rawProductIds.length > 0
  const hasRacks = rawRackItems.length > 0

  if (hasProducts === hasRacks) {
    throw new CheckoutValidationError('El carrito no es válido')
  }

  if (rawProductIds.length > 10 || rawRackItems.length > 10) {
    throw new CheckoutValidationError('El carrito no es válido')
  }

  const productIds = rawProductIds.map((value) => {
    if (typeof value !== 'string' || !UUID_RE.test(value)) {
      throw new CheckoutValidationError('El carrito contiene un producto inválido')
    }
    return value.toLowerCase()
  })

  if (new Set(productIds).size !== productIds.length) {
    throw new CheckoutValidationError('Un producto no puede repetirse en el carrito')
  }

  const rackItems = rawRackItems.map((value): RackCheckoutItem => {
    const item = objectValue(value, 'Producto')
    if (
      typeof item.slug !== 'string' ||
      !/^[a-z0-9-]{2,50}$/.test(item.slug) ||
      !['S', 'M', 'L'].includes(String(item.size)) ||
      !Number.isInteger(item.quantity) ||
      Number(item.quantity) < 1 ||
      Number(item.quantity) > 10
    ) {
      throw new CheckoutValidationError('El carrito contiene una variante inválida')
    }
    return {
      slug: item.slug,
      size: item.size as RackCheckoutItem['size'],
      quantity: Number(item.quantity),
    }
  })

  const rackKeys = rackItems.map(item => `${item.slug}:${item.size}`)
  if (new Set(rackKeys).size !== rackKeys.length) {
    throw new CheckoutValidationError('Una talla no puede repetirse en el carrito')
  }
  if (rackItems.reduce((total, item) => total + item.quantity, 0) > 20) {
    throw new CheckoutValidationError('El carrito supera el máximo de unidades')
  }

  if (typeof root.idempotencyKey !== 'string' || !UUID_RE.test(root.idempotencyKey)) {
    throw new CheckoutValidationError('La identificación del checkout no es válida')
  }

  const name = stringValue(buyer.name, 'Nombre', 2, 100)
  const email = stringValue(buyer.email, 'Correo', 3, 254).toLowerCase()
  if (!EMAIL_RE.test(email)) {
    throw new CheckoutValidationError('El correo no es válido')
  }

  const phoneRaw = stringValue(buyer.phone, 'Teléfono', 8, 30)
  const phone = normalizeStoredPhone(phoneRaw)
  if (!phone) {
    throw new CheckoutValidationError(
      'El teléfono debe incluir un número móvil válido'
    )
  }

  const method = delivery.method
  if (method !== 'home' && method !== 'pickup') {
    throw new CheckoutValidationError('El método de entrega no es válido')
  }

  const region = stringValue(delivery.region, 'Región', 2, 100)
  if (!(CHILE_REGIONS as readonly string[]).includes(region)) {
    throw new CheckoutValidationError('La región no es válida')
  }

  const commune = stringValue(delivery.commune, 'Comuna', 2, 100)
  const street =
    method === 'home' ? stringValue(delivery.street, 'Calle', 2, 120) : null
  const number =
    method === 'home' ? stringValue(delivery.number, 'Número', 1, 20) : null
  const pickupPointId =
    method === 'pickup'
      ? stringValue(delivery.pickupPointId, 'Sucursal o punto', 2, 120)
      : null

  const extra = optionalString(delivery.extra, 'Información adicional', 160)

  let couponCode: string | null = null
  if (root.couponCode != null && root.couponCode !== '') {
    couponCode = stringValue(root.couponCode, 'Cupón', 3, 32).toUpperCase()
    if (!COUPON_RE.test(couponCode)) {
      throw new CheckoutValidationError('El cupón no es válido')
    }
  }

  return {
    productIds,
    rackItems,
    idempotencyKey: root.idempotencyKey.toLowerCase(),
    buyer: { name, email, phone },
    delivery: {
      method,
      region,
      commune,
      street,
      number,
      extra,
      pickupPointId,
    },
    couponCode,
  }
}

export function checkoutFingerprint(input: CheckoutInput): string {
  const canonical = JSON.stringify({
    productIds: [...input.productIds].sort(),
    rackItems: [...input.rackItems].sort((a, b) => (
      `${a.slug}:${a.size}`.localeCompare(`${b.slug}:${b.size}`)
    )),
    buyer: input.buyer,
    delivery: input.delivery,
    couponCode: input.couponCode,
  })
  return createHash('sha256').update(canonical).digest('hex')
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
