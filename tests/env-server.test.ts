import { afterEach, describe, expect, it, vi } from 'vitest'
import {
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
