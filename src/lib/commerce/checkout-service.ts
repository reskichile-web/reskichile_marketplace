import 'server-only'

import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'crypto'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { PaymentConfig } from '@/lib/env/server'
import {
  checkoutFingerprint,
  type CheckoutInput,
  type RackCheckoutItem,
  sha256,
} from './checkout-validation'
import {
  createWebpayTransaction,
  safeWebpayError,
} from '@/lib/payments/webpay-client'
import {
  selectBestShippingRate,
  type ShippingOriginCode,
  type TableShippingRateCandidate,
} from './fulfillment-selection'

interface CommerceProduct {
  id: string
  brand: string
  model: string | null
  product_type: string
  price: number
  shipping_origin_code: 'los_angeles' | 'las_condes' | null
  packaged_length_cm: number | null
  packaged_width_cm: number | null
  packaged_height_cm: number | null
  packaged_weight_kg: number | null
}

interface RackCommerceVariant {
  inventory_id: string
  product_slug: string
  product_name: string
  material: string
  price_clp: number
  active: boolean
  size: RackCheckoutItem['size']
  stock_on_hand: number
  reserved_quantity: number
  available_quantity: number
  shipping_origin_code: 'los_angeles' | 'las_condes' | null
  packaged_length_cm: number | null
  packaged_width_cm: number | null
  packaged_height_cm: number | null
  packaged_weight_kg: number | null
}

interface QuotedRackVariant extends RackCommerceVariant {
  quantity: number
}

interface CheckoutRpcResult {
  reused: boolean
  order_id: string
  public_id: string
  order_number: string
  total_clp: number
  attempt_id: string
  attempt_state: string
  buy_order: string
  session_id: string
  token: string | null
  webpay_url: string | null
}

export interface CheckoutQuote {
  items: Array<{
    id: string
    name: string
    priceClp: number
    quantity: number
    origin: string
  }>
  subtotalClp: number
  discountClp: number
  shippingClp: number
  shippingRateClp: number
  totalClp: number
  shippingSource: 'sandbox_fixed' | 'table'
  shippingOrigin: ShippingOriginCode
}

export interface CreatedCheckout {
  publicId: string
  orderNumber: string
  totalClp: number
  token: string
  url: string
  guestAccessToken: string
  reused: boolean
}

export class CheckoutServiceError extends Error {
  status: number
  publicMessage: string
  code: string

  constructor(
    code: string,
    publicMessage: string,
    status: number,
    internalMessage?: string
  ) {
    super(internalMessage || publicMessage)
    this.name = 'CheckoutServiceError'
    this.code = code
    this.publicMessage = publicMessage
    this.status = status
  }
}

function productName(product: CommerceProduct): string {
  return [product.brand, product.model].filter(Boolean).join(' ')
}

function productHasPackage(product: CommerceProduct): boolean {
  return (
    product.packaged_length_cm != null &&
    product.packaged_width_cm != null &&
    product.packaged_height_cm != null &&
    product.packaged_weight_kg != null
  )
}

function databaseError(error: unknown): CheckoutServiceError {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : ''

  if (
    message.includes('unavailable') ||
    message.includes('active_reservation') ||
    message.includes('insufficient rack stock')
  ) {
    return new CheckoutServiceError(
      'PRODUCT_UNAVAILABLE',
      'El producto ya no está disponible.',
      409
    )
  }
  if (
    message.includes('coupon') ||
    message.includes('promotion') ||
    message.includes('redemption')
  ) {
    return new CheckoutServiceError(
      'COUPON_INVALID',
      'El cupón no está disponible o ya fue utilizado.',
      422
    )
  }
  if (message.includes('package dimensions')) {
    return new CheckoutServiceError(
      'PACKAGE_INCOMPLETE',
      'Este producto todavía no tiene despacho configurado.',
      422
    )
  }
  if (message.includes('idempotency')) {
    return new CheckoutServiceError(
      'IDEMPOTENCY_CONFLICT',
      'El checkout cambió. Recarga la página e inténtalo nuevamente.',
      409
    )
  }

  return new CheckoutServiceError(
    'DATABASE_ERROR',
    'No pudimos preparar la compra. Inténtalo nuevamente.',
    500,
    'commerce database operation failed'
  )
}

function rackHasPackage(product: RackCommerceVariant): boolean {
  return (
    product.packaged_length_cm != null &&
    product.packaged_width_cm != null &&
    product.packaged_height_cm != null &&
    product.packaged_weight_kg != null
  )
}

async function loadRackVariantCandidates(
  config: PaymentConfig,
  input: CheckoutInput,
): Promise<Map<ShippingOriginCode, QuotedRackVariant[]>> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('commerce_rack_availability')
  if (error) throw databaseError(error)

  const rows = (data || []) as RackCommerceVariant[]
  const candidates = new Map<ShippingOriginCode, QuotedRackVariant[]>()
  for (const origin of ['los_angeles', 'las_condes'] as const) {
    const variants = input.rackItems.flatMap(item => {
      const variant = rows.find(row => (
        row.product_slug === item.slug &&
        row.size === item.size &&
        row.shipping_origin_code === origin &&
        row.active &&
        Number(row.available_quantity) >= item.quantity
      ))
      return variant ? [{ ...variant, quantity: item.quantity }] : []
    })
    if (variants.length === input.rackItems.length) candidates.set(origin, variants)
  }

  if (candidates.size === 0) {
    throw new CheckoutServiceError(
      'PRODUCT_UNAVAILABLE',
      'No hay una ubicación con stock suficiente para completar este carrito.',
      409,
    )
  }

  if (!config.allowIncompleteShippingInSandbox && Array.from(candidates.values()).every(
    variants => variants.some(variant => !rackHasPackage(variant))
  )) {
    throw new CheckoutServiceError(
      'PACKAGE_INCOMPLETE',
      'Este producto todavía no tiene dimensiones de despacho.',
      422,
    )
  }

  return candidates
}

interface ShippingRateRow {
  id: string
  shipping_origin_code: ShippingOriginCode
  service_code: string
  amount_clp: number
  min_delivery_days: number | null
  max_delivery_days: number | null
  shipping_zones: {
    region: string | null
    commune: string | null
    priority: number
  } | Array<{
    region: string | null
    commune: string | null
    priority: number
  }>
}

async function quoteShipping(
  config: PaymentConfig,
  input: CheckoutInput,
  origins: ShippingOriginCode[],
  parcelCount: number,
): Promise<{ amountClp: number; source: 'sandbox_fixed' | 'table'; origin: ShippingOriginCode }> {
  if (!Number.isSafeInteger(parcelCount) || parcelCount < 1 || parcelCount > 20) {
    throw new CheckoutServiceError(
      'INVALID_PACKAGE_COUNT',
      'No pudimos calcular los paquetes de este carrito.',
      422,
    )
  }

  const orderAmount = (unitAmountClp: number): number => {
    const amount = Number(unitAmountClp) * parcelCount
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 10000000) {
      throw new CheckoutServiceError(
        'INVALID_SHIPPING_RATE',
        'No pudimos calcular una tarifa de despacho válida.',
        500,
      )
    }
    return amount
  }

  if (config.shippingRateSource === 'sandbox_fixed') {
    if (origins.length < 1) {
      throw new CheckoutServiceError(
        'SHIPPING_NOT_READY',
        'No hay una ubicación disponible para despachar este carrito.',
        503,
      )
    }
    // Sandbox uses a fixed rate, so a stable warehouse preference is enough.
    // Production compares persisted rates before selecting the origin.
    return {
      amountClp: orderAmount(config.sandboxShippingClp),
      source: 'sandbox_fixed',
      origin: origins[0],
    }
  }

  const now = new Date().toISOString()
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('shipping_rates')
    .select(
      'id, shipping_origin_code, service_code, amount_clp, min_delivery_days, max_delivery_days, shipping_zones!inner(region, commune, priority)'
    )
    .in('shipping_origin_code', origins)
    .eq('handling_class', 'standard')
    .eq('active', true)
    .eq('shipping_zones.active', true)
    .eq('shipping_zones.delivery_method', input.delivery.method)
    .lte('valid_from', now)
    .or(`valid_until.is.null,valid_until.gt.${now}`)

  if (error) throw databaseError(error)

  const rates: TableShippingRateCandidate[] = ((data || []) as unknown as ShippingRateRow[])
    .flatMap(row => {
      const zone = Array.isArray(row.shipping_zones)
        ? row.shipping_zones[0]
        : row.shipping_zones
      if (!zone || !Number.isSafeInteger(Number(row.amount_clp))) return []
      return [{
        id: row.id,
        originCode: row.shipping_origin_code,
        serviceCode: row.service_code,
        // One finished box per unit. Persisted table rates are per box.
        amountClp: orderAmount(Number(row.amount_clp)),
        minDeliveryDays: row.min_delivery_days == null ? null : Number(row.min_delivery_days),
        maxDeliveryDays: row.max_delivery_days == null ? null : Number(row.max_delivery_days),
        zonePriority: Number(zone.priority),
        zoneRegion: zone.region,
        zoneCommune: zone.commune,
      }]
    })

  const selected = selectBestShippingRate(
    rates,
    input.delivery.region,
    input.delivery.commune,
  )
  if (!selected) {
    throw new CheckoutServiceError(
      'SHIPPING_NOT_AVAILABLE',
      'Todavía no tenemos una tarifa de despacho aprobada para esta comuna.',
      422,
    )
  }

  return { amountClp: selected.amountClp, source: 'table', origin: selected.originCode }
}

async function loadProducts(
  config: PaymentConfig,
  input: CheckoutInput
): Promise<CommerceProduct[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, brand, model, product_type, price, shipping_origin_code, packaged_length_cm, packaged_width_cm, packaged_height_cm, packaged_weight_kg'
    )
    .in('id', input.productIds)
    .eq('status', 'approved')
    .eq('commerce_owned', true)

  if (error) throw databaseError(error)

  const products = (data || []) as unknown as CommerceProduct[]
  if (products.length !== input.productIds.length) {
    throw new CheckoutServiceError(
      'PRODUCT_UNAVAILABLE',
      'Uno de los productos ya no está disponible.',
      409
    )
  }

  const origins = new Set(products.map((product) => product.shipping_origin_code))
  if (origins.size !== 1 || origins.has(null)) {
    throw new CheckoutServiceError(
      'ORIGIN_UNAVAILABLE',
      'El origen de despacho no está configurado.',
      422
    )
  }

  if (
    !config.allowIncompleteShippingInSandbox &&
    products.some((product) => !productHasPackage(product))
  ) {
    throw new CheckoutServiceError(
      'PACKAGE_INCOMPLETE',
      'Este producto todavía no tiene dimensiones de despacho.',
      422
    )
  }

  return products
}

async function quoteDiscount(
  config: PaymentConfig,
  input: CheckoutInput,
  subtotalClp: number
): Promise<{ discountClp: number; freeShipping: boolean }> {
  if (!input.couponCode) return { discountClp: 0, freeShipping: false }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('promotions')
    .select(
      'discount_type, value, max_discount_clp, min_subtotal_clp, active, starts_at, ends_at'
    )
    .eq('environment', config.environment)
    .eq('code', input.couponCode)
    .eq('active', true)
    .maybeSingle()

  if (error) throw databaseError(error)
  if (!data) {
    throw new CheckoutServiceError(
      'COUPON_INVALID',
      'El cupón no está disponible.',
      422
    )
  }

  const now = Date.now()
  if (
    subtotalClp < Number(data.min_subtotal_clp || 0) ||
    (data.starts_at && Date.parse(data.starts_at) > now) ||
    (data.ends_at && Date.parse(data.ends_at) <= now)
  ) {
    throw new CheckoutServiceError(
      'COUPON_INVALID',
      'El cupón no está disponible.',
      422
    )
  }

  if (data.discount_type === 'percent') {
    const calculated = Math.floor(subtotalClp * Number(data.value) / 100)
    return {
      discountClp: data.max_discount_clp
        ? Math.min(calculated, Number(data.max_discount_clp))
        : calculated,
      freeShipping: false,
    }
  }

  if (data.discount_type === 'fixed') {
    return {
      discountClp: Math.min(Number(data.value), subtotalClp),
      freeShipping: false,
    }
  }

  return {
    discountClp: 0,
    freeShipping: data.discount_type === 'free_shipping',
  }
}

export async function quoteCheckout(
  config: PaymentConfig,
  input: CheckoutInput
): Promise<CheckoutQuote> {
  if (!config.enabled) {
    throw new CheckoutServiceError(
      'PAYMENTS_DISABLED',
      'Los pagos todavía están en preparación.',
      503
    )
  }

  if (
    config.environment === 'integration' &&
    config.sandboxBuyerEmails.length > 0 &&
    !config.sandboxBuyerEmails.includes(input.buyer.email)
  ) {
    throw new CheckoutServiceError(
      'SANDBOX_BUYER_NOT_ALLOWED',
      'Este correo no está autorizado para pruebas de pago.',
      403
    )
  }

  const rackCandidates = input.rackItems.length > 0
    ? await loadRackVariantCandidates(config, input)
    : new Map<ShippingOriginCode, QuotedRackVariant[]>()
  const products = rackCandidates.size === 0 ? await loadProducts(config, input) : []
  const productOrigins = products.map(product => product.shipping_origin_code)
  const candidateOrigins = rackCandidates.size > 0
    ? Array.from(rackCandidates.keys())
    : productOrigins.filter((origin): origin is ShippingOriginCode => origin != null)
  const parcelCount = input.rackItems.length > 0
    ? input.rackItems.reduce((sum, item) => sum + item.quantity, 0)
    : input.productIds.length
  const shipping = await quoteShipping(config, input, candidateOrigins, parcelCount)
  const rackVariants = rackCandidates.get(shipping.origin) || []
  const subtotalClp = rackVariants.length > 0
    ? rackVariants.reduce((sum, variant) => sum + Number(variant.price_clp) * variant.quantity, 0)
    : products.reduce((sum, product) => sum + product.price, 0)
  const discount = await quoteDiscount(config, input, subtotalClp)
  const discountClp = discount.discountClp
  const shippingClp = discount.freeShipping ? 0 : shipping.amountClp
  const totalClp = subtotalClp - discountClp + shippingClp

  if (!Number.isSafeInteger(totalClp) || totalClp <= 0) {
    throw new CheckoutServiceError(
      'INVALID_TOTAL',
      'No pudimos calcular un total válido.',
      500
    )
  }

  return {
    items: rackVariants.length > 0
      ? rackVariants.map(variant => ({
          id: variant.inventory_id,
          name: `${variant.product_name} · Talla ${variant.size}`,
          priceClp: Number(variant.price_clp),
          quantity: variant.quantity,
          origin: variant.shipping_origin_code as string,
        }))
      : products.map((product) => ({
          id: product.id,
          name: productName(product),
          priceClp: product.price,
          quantity: 1,
          origin: product.shipping_origin_code as string,
        })),
    subtotalClp,
    discountClp,
    shippingClp,
    shippingRateClp: shipping.amountClp,
    totalClp,
    shippingSource: shipping.source,
    shippingOrigin: shipping.origin,
  }
}

function checkoutIdentifiers(): {
  orderNumber: string
  buyOrder: string
  sessionId: string
} {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = randomBytes(5).toString('hex').toUpperCase()
  const day = new Date().toISOString().slice(2, 10).replace(/-/g, '')

  return {
    orderNumber: 'RC-' + day + '-' + random.slice(0, 8),
    buyOrder: ('RC' + timestamp + random).slice(0, 26),
    sessionId: randomBytes(24).toString('hex'),
  }
}

async function optionalBuyerUserId(): Promise<string | null> {
  try {
    const supabase = createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user?.id || null
  } catch {
    return null
  }
}

export async function createCheckout(
  config: PaymentConfig,
  input: CheckoutInput,
  guestAccessToken: string
): Promise<CreatedCheckout> {
  const quote = await quoteCheckout(config, input)
  const fingerprint = checkoutFingerprint(input)
  const guestAccessHash = sha256(guestAccessToken)
  const identifiers = checkoutIdentifiers()
  const correlationId = randomUUID()
  const supabase = createServiceRoleClient()

  const checkoutParams = {
    p_buyer_user_id: await optionalBuyerUserId(),
    p_buyer_email: input.buyer.email,
    p_buyer_name: input.buyer.name,
    p_buyer_phone: input.buyer.phone,
    p_delivery_method: input.delivery.method,
    p_shipping_region: input.delivery.region,
    p_shipping_commune: input.delivery.commune,
    p_shipping_street: input.delivery.street,
    p_shipping_number: input.delivery.number,
    p_shipping_extra: input.delivery.extra,
    p_pickup_point_id: input.delivery.pickupPointId,
    // The database validates the undiscounted rate first and then applies a
    // possible free-shipping promotion atomically with the order.
    p_shipping_amount_clp: quote.shippingRateClp,
    p_shipping_source: quote.shippingSource,
    p_coupon_code: input.couponCode,
    p_environment: config.environment,
    p_idempotency_key: input.idempotencyKey,
    p_request_fingerprint: fingerprint,
    p_order_number: identifiers.orderNumber,
    p_buy_order: identifiers.buyOrder,
    p_session_id: identifiers.sessionId,
    p_guest_access_hash: guestAccessHash,
    p_reservation_minutes: config.inventoryReservationMinutes,
    p_allow_incomplete_shipping: config.allowIncompleteShippingInSandbox,
  }
  const { data, error } = input.rackItems.length > 0
    ? await supabase.rpc('commerce_create_rack_checkout', {
        ...checkoutParams,
        p_items: input.rackItems,
        p_shipping_origin_code: quote.shippingOrigin,
      })
    : await supabase.rpc('commerce_create_checkout', {
        ...checkoutParams,
        p_product_ids: input.productIds,
      })

  if (error || !data) throw databaseError(error)
  const checkout = data as unknown as CheckoutRpcResult

  if (
    checkout.reused &&
    checkout.attempt_state === 'initialized' &&
    checkout.token &&
    checkout.webpay_url
  ) {
    return {
      publicId: checkout.public_id,
      orderNumber: checkout.order_number,
      totalClp: checkout.total_clp,
      token: checkout.token,
      url: checkout.webpay_url,
      guestAccessToken,
      reused: true,
    }
  }

  if (checkout.attempt_state !== 'created') {
    throw new CheckoutServiceError(
      'CHECKOUT_ALREADY_USED',
      'Esta compra ya fue procesada. Recarga la página para comenzar otra.',
      409
    )
  }

  try {
    const returnUrl = new URL(
      '/api/payments/webpay/return',
      config.appUrl
    ).toString()
    const initialized = await createWebpayTransaction(config, {
      buyOrder: checkout.buy_order,
      sessionId: checkout.session_id,
      amount: checkout.total_clp,
      returnUrl,
    })

    const { data: stored, error: storeError } = await supabase.rpc(
      'commerce_store_webpay_initialization',
      {
        p_attempt_id: checkout.attempt_id,
        p_token: initialized.token,
        p_webpay_url: initialized.url,
        p_correlation_id: correlationId,
      }
    )

    if (storeError || stored !== true) {
      throw new CheckoutServiceError(
        'TOKEN_NOT_PERSISTED',
        'No pudimos guardar la transacción. No se realizó ningún cobro.',
        500
      )
    }

    return {
      publicId: checkout.public_id,
      orderNumber: checkout.order_number,
      totalClp: checkout.total_clp,
      token: initialized.token,
      url: initialized.url,
      guestAccessToken,
      reused: false,
    }
  } catch (error) {
    await supabase.rpc('commerce_fail_webpay_initialization', {
      p_attempt_id: checkout.attempt_id,
      p_correlation_id: correlationId,
      p_reason: safeWebpayError(error),
    })

    if (error instanceof CheckoutServiceError) throw error

    throw new CheckoutServiceError(
      'WEBPAY_INITIALIZATION_FAILED',
      'Webpay no respondió. No se realizó ningún cobro.',
      502,
      safeWebpayError(error)
    )
  }
}

export async function consumeCheckoutRateLimit(
  config: PaymentConfig,
  request: Request,
  scope: 'quote' | 'create'
): Promise<void> {
  if (!config.enabled) {
    throw new CheckoutServiceError(
      'PAYMENTS_DISABLED',
      'Los pagos todavía están en preparación.',
      503
    )
  }

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = (forwarded?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown')
    .trim()
    .slice(0, 64)
  const keyHash = createHash('sha256')
    .update(config.rateLimitSecret)
    .update(':')
    .update(scope)
    .update(':')
    .update(ip)
    .digest('hex')

  const limit = scope === 'quote' ? 30 : 10
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('commerce_consume_rate_limit', {
    p_key_hash: keyHash,
    p_window_seconds: 3600,
    p_limit: limit,
  })

  if (error) throw databaseError(error)
  if (data !== true) {
    throw new CheckoutServiceError(
      'RATE_LIMITED',
      'Demasiados intentos. Espera antes de volver a intentar.',
      429
    )
  }
}

export function assertTrustedCheckoutRequest(
  config: PaymentConfig,
  request: Request
): void {
  const origin = request.headers.get('origin')
  if (!origin || origin !== config.appUrl.origin) {
    throw new CheckoutServiceError(
      'INVALID_ORIGIN',
      'La solicitud no tiene un origen permitido.',
      403
    )
  }

  const contentType = request.headers.get('content-type') || ''
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase()
  if (mediaType !== 'application/json') {
    throw new CheckoutServiceError(
      'INVALID_CONTENT_TYPE',
      'El formato de la solicitud no es válido.',
      415
    )
  }

  const contentLength = Number(request.headers.get('content-length') || '0')
  if (Number.isFinite(contentLength) && contentLength > 16384) {
    throw new CheckoutServiceError(
      'BODY_TOO_LARGE',
      'La solicitud es demasiado grande.',
      413
    )
  }
}

export function paymentAccessCookie(publicId: string, token: string): string {
  return publicId + '.' + token
}

export function verifyPaymentAccessCookie(
  cookieValue: string | undefined,
  publicId: string,
  expectedHash: string
): boolean {
  if (!cookieValue) return false
  const separator = cookieValue.indexOf('.')
  if (separator < 1) return false
  const cookiePublicId = cookieValue.slice(0, separator)
  const token = cookieValue.slice(separator + 1)
  if (cookiePublicId !== publicId || token.length < 32 || token.length > 128) {
    return false
  }
  const actual = Buffer.from(sha256(token), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function derivePaymentAccessToken(
  config: PaymentConfig,
  idempotencyKey: string
): string {
  // A deterministic, server-authenticated token lets a lost HTTP response be
  // retried with the same idempotency key without sharing access across orders.
  return createHmac('sha256', config.rateLimitSecret)
    .update('reski-order-access:v1:' + idempotencyKey)
    .digest('base64url')
}

export function paymentAccessCookieName(config: PaymentConfig): string {
  return config.appUrl.protocol === 'https:'
    ? '__Host-reski_order_access'
    : 'reski_order_access'
}

export async function readCheckoutJson(request: Request): Promise<unknown> {
  const maximumBytes = 16384
  if (!request.body) {
    throw new CheckoutServiceError(
      'INVALID_BODY',
      'La solicitud no contiene datos.',
      400
    )
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const part = await reader.read()
    if (part.done) break
    received += part.value.byteLength
    if (received > maximumBytes) {
      await reader.cancel()
      throw new CheckoutServiceError(
        'BODY_TOO_LARGE',
        'La solicitud es demasiado grande.',
        413
      )
    }
    chunks.push(part.value)
  }

  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  let textValue: string
  try {
    textValue = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return JSON.parse(textValue) as unknown
  } catch {
    throw new CheckoutServiceError(
      'INVALID_JSON',
      'La solicitud no contiene JSON válido.',
      400
    )
  }
}
