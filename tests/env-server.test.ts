import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getAddressConfig,
  getAppUrl,
  getPaymentCallbackConfig,
  getPaymentConfig,
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
