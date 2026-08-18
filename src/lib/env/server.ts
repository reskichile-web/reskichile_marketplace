import 'server-only'

export type PaymentEnvironment = 'integration' | 'production'
export type ShippingRateSource = 'sandbox_fixed' | 'table'
type PaymentConfigPurpose = 'checkout' | 'callback' | 'reconciliation'

export interface PaymentConfig {
  enabled: boolean
  environment: PaymentEnvironment
  appUrl: URL
  transbankCommerceCode?: string
  transbankApiKeySecret?: string
  transbankTimeoutMs: number
  sandboxShippingClp: number
  shippingRateSource: ShippingRateSource
  allowIncompleteShippingInSandbox: boolean
  inventoryReservationMinutes: number
  rateLimitSecret: string
  reconciliationJobSecret: string
}

export interface RefundConfig {
  enabled: boolean
  requireAal2: boolean
  recentSessionMinutes: number
  rateLimitSecret: string
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigurationError'
  }
}

function parseInteger(
  name: string,
  value: string | undefined,
  minimum: number,
  maximum: number
): number {
  if (!value || !/^[0-9]+$/.test(value)) {
    throw new ConfigurationError(name + ' debe ser un entero')
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ConfigurationError(name + ' está fuera de rango')
  }

  return parsed
}

export function isPaymentsEnabled(): boolean {
  return process.env.PAYMENTS_ENABLED === 'true'
}

export function getAppUrl(): URL {
  const raw =
    process.env.APP_URL ||
    (process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:4173')

  if (!raw) {
    throw new ConfigurationError('APP_URL no está configurada')
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ConfigurationError('APP_URL no es una URL válida')
  }

  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new ConfigurationError('APP_URL debe contener solo el origen canónico')
  }

  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new ConfigurationError('APP_URL debe usar HTTPS en producción')
  }

  return url
}

function buildPaymentConfig(
  environment: PaymentEnvironment,
  purpose: PaymentConfigPurpose
): PaymentConfig {
  const enabled = isPaymentsEnabled()
  const appUrl = getAppUrl()

  const transbankTimeoutMs = parseInteger(
    'TRANSBANK_TIMEOUT_MS',
    process.env.TRANSBANK_TIMEOUT_MS || '8000',
    1000,
    20000
  )

  const inventoryReservationMinutes = parseInteger(
    'INVENTORY_RESERVATION_MINUTES',
    process.env.INVENTORY_RESERVATION_MINUTES || '15',
    5,
    30
  )

  const shippingRateSourceRaw = process.env.SHIPPING_RATE_SOURCE || 'table'
  if (shippingRateSourceRaw !== 'sandbox_fixed' && shippingRateSourceRaw !== 'table') {
    throw new ConfigurationError('SHIPPING_RATE_SOURCE no es válido')
  }
  const shippingRateSource = shippingRateSourceRaw as ShippingRateSource

  const sandboxShippingClp =
    environment === 'integration' && shippingRateSource === 'sandbox_fixed' && enabled
      ? parseInteger('SANDBOX_SHIPPING_CLP', process.env.SANDBOX_SHIPPING_CLP, 0, 1000000)
      : 0

  const rateLimitSecret = process.env.CHECKOUT_RATE_LIMIT_SECRET || ''
  const reconciliationJobSecret = process.env.RECONCILIATION_JOB_SECRET || ''

  if (purpose === 'checkout' && enabled && rateLimitSecret.length < 32) {
    throw new ConfigurationError(
      'CHECKOUT_RATE_LIMIT_SECRET debe tener al menos 32 caracteres'
    )
  }

  // Reconciliation must remain available while new payments are disabled.
  // Otherwise an operator kill switch could strand a payment already committed
  // at Transbank but not yet finalized in our database.
  if (
    purpose === 'reconciliation' &&
    reconciliationJobSecret.length < 32
  ) {
    throw new ConfigurationError(
      'RECONCILIATION_JOB_SECRET debe tener al menos 32 caracteres'
    )
  }

  const transbankCommerceCode = process.env.TRANSBANK_COMMERCE_CODE
  const transbankApiKeySecret = process.env.TRANSBANK_API_KEY_SECRET

  if (environment === 'production') {
    if (!transbankCommerceCode || !transbankApiKeySecret) {
      throw new ConfigurationError('Faltan credenciales productivas de Transbank')
    }

    if (
      purpose === 'checkout' &&
      shippingRateSource !== 'table'
    ) {
      throw new ConfigurationError(
        'Producción requiere tarifas de despacho persistidas y aprobadas'
      )
    }

    if (
      purpose === 'checkout' &&
      process.env.ALLOW_INCOMPLETE_SHIPPING_IN_SANDBOX === 'true'
    ) {
      throw new ConfigurationError(
        'No se permiten dimensiones incompletas en producción'
      )
    }
  }

  return {
    enabled,
    environment,
    appUrl,
    transbankCommerceCode,
    transbankApiKeySecret,
    transbankTimeoutMs,
    sandboxShippingClp,
    shippingRateSource,
    allowIncompleteShippingInSandbox:
      environment === 'integration' &&
      process.env.ALLOW_INCOMPLETE_SHIPPING_IN_SANDBOX === 'true',
    inventoryReservationMinutes,
    rateLimitSecret,
    reconciliationJobSecret,
  }
}

export function getPaymentConfigForEnvironment(
  environment: PaymentEnvironment
): PaymentConfig {
  return buildPaymentConfig(environment, 'callback')
}

function configuredPaymentEnvironment(): PaymentEnvironment {
  const environmentRaw = process.env.TRANSBANK_ENVIRONMENT || 'integration'

  if (environmentRaw !== 'integration' && environmentRaw !== 'production') {
    throw new ConfigurationError('TRANSBANK_ENVIRONMENT no es válido')
  }

  return environmentRaw
}

/** Configuration used only before creating a new sale. */
export function getPaymentConfig(): PaymentConfig {
  return buildPaymentConfig(configuredPaymentEnvironment(), 'checkout')
}

/** Configuration kept independent from checkout/shipping kill switches. */
export function getPaymentCallbackConfig(): PaymentConfig {
  return buildPaymentConfig(configuredPaymentEnvironment(), 'callback')
}

/** Configuration for the authenticated recovery worker. */
export function getPaymentReconciliationConfig(): PaymentConfig {
  return buildPaymentConfig(configuredPaymentEnvironment(), 'reconciliation')
}

/** Extra gates for the destructive administrative refund operation. */
export function getRefundConfig(): RefundConfig {
  const enabled = process.env.REFUNDS_ENABLED === 'true'
  const requireAal2 = process.env.REFUNDS_REQUIRE_AAL2 !== 'false'
  const recentSessionMinutes = parseInteger(
    'REFUND_RECENT_SESSION_MINUTES',
    process.env.REFUND_RECENT_SESSION_MINUTES || '30',
    5,
    120
  )
  const rateLimitSecret = process.env.ADMIN_ACTION_RATE_LIMIT_SECRET || ''

  if (enabled && rateLimitSecret.length < 32) {
    throw new ConfigurationError(
      'ADMIN_ACTION_RATE_LIMIT_SECRET debe tener al menos 32 caracteres'
    )
  }
  if (
    enabled &&
    configuredPaymentEnvironment() === 'production' &&
    !requireAal2
  ) {
    throw new ConfigurationError('Producción exige AAL2 para reembolsos')
  }

  return { enabled, requireAal2, recentSessionMinutes, rateLimitSecret }
}

/** Shared bearer secret for Supabase Cron commerce workers. */
export function getCommerceJobSecret(): string {
  const secret = process.env.RECONCILIATION_JOB_SECRET || ''
  if (secret.length < 32) {
    throw new ConfigurationError(
      'RECONCILIATION_JOB_SECRET debe tener al menos 32 caracteres'
    )
  }
  return secret
}
