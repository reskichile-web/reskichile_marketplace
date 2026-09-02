import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildWebpayReturnUrl,
  getAddressConfig,
  getAppUrl,
  getPaymentCallbackConfig,
  getPaymentConfig,
  WEBPAY_RETURN_URL_MAX_LENGTH,
} from '@/lib/env/server'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getAppUrl', () => {
  it('uses the verified canonical domain when Vercel has no APP_URL', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', undefined)
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://reskichile.cl')

    expect(getAppUrl().origin).toBe('https://www.reskichile.cl')
  })

  it('keeps an explicitly configured canonical origin', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', 'https://checkout.reskichile.cl')

    expect(getAppUrl().origin).toBe('https://checkout.reskichile.cl')
  })
})

describe('sandbox checkout allowlist', () => {
  function stubEnabledSandbox() {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', 'https://sandbox.reskichile.cl')
    vi.stubEnv('PAYMENTS_ENABLED', 'true')
    vi.stubEnv('TRANSBANK_ENVIRONMENT', 'integration')
    vi.stubEnv('SHIPPING_RATE_SOURCE', 'sandbox_fixed')
    vi.stubEnv('SANDBOX_SHIPPING_CLP', '3990')
    vi.stubEnv('CHECKOUT_RATE_LIMIT_SECRET', 'r'.repeat(32))
  }

  it('fails closed without authorized buyer emails on a deployed sandbox', () => {
    stubEnabledSandbox()
    vi.stubEnv('SANDBOX_BUYER_EMAIL_ALLOWLIST', undefined)

    expect(() => getPaymentConfig()).toThrow(
      'SANDBOX_BUYER_EMAIL_ALLOWLIST es obligatoria'
    )
  })

  it('normalizes and deduplicates authorized buyer emails', () => {
    stubEnabledSandbox()
    vi.stubEnv(
      'SANDBOX_BUYER_EMAIL_ALLOWLIST',
      ' Compras@Example.cl,compras@example.cl, QA@example.cl '
    )

    expect(getPaymentConfig().sandboxBuyerEmails).toEqual([
      'compras@example.cl',
      'qa@example.cl',
    ])
  })

  it('keeps callbacks independent from malformed checkout-only gates', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', 'https://www.reskichile.cl')
    vi.stubEnv('PAYMENTS_ENABLED', 'true')
    vi.stubEnv('TRANSBANK_ENVIRONMENT', 'integration')
    vi.stubEnv('SHIPPING_RATE_SOURCE', 'invalid')
    vi.stubEnv('SANDBOX_BUYER_EMAIL_ALLOWLIST', 'not-an-email')
    vi.stubEnv('INVENTORY_RESERVATION_MINUTES', 'invalid')

    expect(getPaymentCallbackConfig()).toMatchObject({
      environment: 'integration',
      shippingRateSource: 'table',
      sandboxBuyerEmails: [],
    })
  })
})

describe('Webpay return URL for protected Vercel previews', () => {
  function stubEnabledIntegrationPreview() {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', 'https://sandbox.reskichile.cl')
    vi.stubEnv('PAYMENTS_ENABLED', 'true')
    vi.stubEnv('TRANSBANK_ENVIRONMENT', 'integration')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', 'b'.repeat(32))
    vi.stubEnv('SHIPPING_RATE_SOURCE', 'sandbox_fixed')
    vi.stubEnv('SANDBOX_SHIPPING_CLP', '3990')
    vi.stubEnv('SANDBOX_BUYER_EMAIL_ALLOWLIST', 'qa@example.cl')
    vi.stubEnv('CHECKOUT_RATE_LIMIT_SECRET', 'r'.repeat(32))
  }

  it('adds only the automation bypass to an enabled Integration Preview', () => {
    stubEnabledIntegrationPreview()

    const returnUrl = new URL(buildWebpayReturnUrl(getPaymentConfig()))

    expect(returnUrl.origin).toBe('https://sandbox.reskichile.cl')
    expect(returnUrl.pathname).toBe('/api/payments/webpay/return')
    expect(returnUrl.searchParams.get('x-vercel-protection-bypass')).toBe(
      'b'.repeat(32)
    )
    expect(returnUrl.searchParams.has('x-vercel-set-bypass-cookie')).toBe(false)
  })

  it('never adds the bypass to a Vercel Production deployment', () => {
    stubEnabledIntegrationPreview()
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', undefined)

    const returnUrl = new URL(buildWebpayReturnUrl(getPaymentConfig()))

    expect(returnUrl.toString()).toBe(
      'https://sandbox.reskichile.cl/api/payments/webpay/return'
    )
    expect(returnUrl.searchParams.has('x-vercel-protection-bypass')).toBe(false)
  })

  it('never adds the bypass to a Transbank Production transaction', () => {
    stubEnabledIntegrationPreview()
    vi.stubEnv('TRANSBANK_ENVIRONMENT', 'production')
    vi.stubEnv('SHIPPING_RATE_SOURCE', 'table')
    vi.stubEnv('TRANSBANK_COMMERCE_CODE', 'production-commerce-code')
    vi.stubEnv('TRANSBANK_API_KEY_SECRET', 'production-api-key')
    vi.stubEnv('ADDRESS_VALIDATION_ENABLED', 'true')

    const returnUrl = new URL(buildWebpayReturnUrl(getPaymentConfig()))

    expect(returnUrl.toString()).toBe(
      'https://sandbox.reskichile.cl/api/payments/webpay/return'
    )
    expect(returnUrl.searchParams.has('x-vercel-protection-bypass')).toBe(false)
  })

  it('fails closed when an enabled Integration Preview has no bypass secret', () => {
    stubEnabledIntegrationPreview()
    vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', undefined)

    expect(() => getPaymentConfig()).toThrow(
      'VERCEL_AUTOMATION_BYPASS_SECRET es obligatorio'
    )
  })

  it('accepts the maximum return URL length and rejects one extra character', () => {
    stubEnabledIntegrationPreview()
    const emptyBypassUrl = new URL(
      '/api/payments/webpay/return',
      'https://sandbox.reskichile.cl'
    )
    emptyBypassUrl.searchParams.set('x-vercel-protection-bypass', '')
    const maximumSecretLength =
      WEBPAY_RETURN_URL_MAX_LENGTH - emptyBypassUrl.toString().length

    vi.stubEnv(
      'VERCEL_AUTOMATION_BYPASS_SECRET',
      'a'.repeat(maximumSecretLength)
    )
    expect(buildWebpayReturnUrl(getPaymentConfig())).toHaveLength(
      WEBPAY_RETURN_URL_MAX_LENGTH
    )

    vi.stubEnv(
      'VERCEL_AUTOMATION_BYPASS_SECRET',
      'a'.repeat(maximumSecretLength + 1)
    )
    expect(() => buildWebpayReturnUrl(getPaymentConfig())).toThrow(
      `WEBPAY return_url supera el límite de ${WEBPAY_RETURN_URL_MAX_LENGTH} caracteres`
    )
  })
})

describe('address validation configuration', () => {
  it('stays disabled without requiring provider secrets', () => {
    vi.stubEnv('ADDRESS_VALIDATION_ENABLED', undefined)
    vi.stubEnv('GOOGLE_MAPS_SERVER_API_KEY', undefined)
    vi.stubEnv('ADDRESS_VALIDATION_SIGNING_SECRET', undefined)

    expect(getAddressConfig()).toMatchObject({
      enabled: false,
      provider: 'google',
      timeoutMs: 5000,
    })
  })

  it('fails closed when an enabled provider is missing server-only secrets', () => {
    vi.stubEnv('ADDRESS_VALIDATION_ENABLED', 'true')
    vi.stubEnv('GOOGLE_MAPS_SERVER_API_KEY', undefined)
    expect(() => getAddressConfig()).toThrow('GOOGLE_MAPS_SERVER_API_KEY')

    vi.stubEnv('GOOGLE_MAPS_SERVER_API_KEY', 'g'.repeat(30))
    vi.stubEnv('ADDRESS_VALIDATION_SIGNING_SECRET', 's'.repeat(32))
    vi.stubEnv('CHECKOUT_RATE_LIMIT_SECRET', 'r'.repeat(32))
    expect(getAddressConfig()).toMatchObject({ enabled: true, provider: 'google' })
  })

  it('does not allow new production payments with address validation disabled', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', 'https://www.reskichile.cl')
    vi.stubEnv('PAYMENTS_ENABLED', 'true')
    vi.stubEnv('TRANSBANK_ENVIRONMENT', 'production')
    vi.stubEnv('TRANSBANK_COMMERCE_CODE', 'production-commerce-code')
    vi.stubEnv('TRANSBANK_API_KEY_SECRET', 'production-api-key')
    vi.stubEnv('SHIPPING_RATE_SOURCE', 'table')
    vi.stubEnv('CHECKOUT_RATE_LIMIT_SECRET', 'r'.repeat(32))
    vi.stubEnv('ADDRESS_VALIDATION_ENABLED', undefined)

    expect(() => getPaymentConfig()).toThrow(
      'Producción requiere validación de dirección habilitada'
    )
  })
})

describe('Chilexpress production configuration', () => {
  it('requires both official API subscriptions when selected', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', 'https://www.reskichile.cl')
    vi.stubEnv('PAYMENTS_ENABLED', 'false')
    vi.stubEnv('TRANSBANK_ENVIRONMENT', 'production')
    vi.stubEnv('TRANSBANK_COMMERCE_CODE', 'production-commerce-code')
    vi.stubEnv('TRANSBANK_API_KEY_SECRET', 'production-api-key')
    vi.stubEnv('SHIPPING_RATE_SOURCE', 'chilexpress')
    vi.stubEnv('CHILEXPRESS_RATING_API_KEY', undefined)
    vi.stubEnv('CHILEXPRESS_COVERAGE_API_KEY', undefined)

    expect(() => getPaymentConfig()).toThrow('credenciales de cotización y cobertura')

    vi.stubEnv('CHILEXPRESS_RATING_API_KEY', 'rating-key')
    vi.stubEnv('CHILEXPRESS_COVERAGE_API_KEY', 'coverage-key')
    expect(getPaymentConfig()).toMatchObject({
      shippingRateSource: 'chilexpress',
      chilexpressBaseUrl: 'https://services.wschilexpress.com/',
    })
  })
})
