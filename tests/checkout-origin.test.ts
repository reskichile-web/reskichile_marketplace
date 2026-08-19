import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canonicalPreviewNavigationRedirect,
  checkoutOriginDiagnostics,
  isTrustedCheckoutOrigin,
  webpayReturnUrl,
} from '@/lib/commerce/checkout-origin'
import {
  assertTrustedCheckoutRequest,
  CheckoutServiceError,
} from '@/lib/commerce/checkout-service'
import type { PaymentConfig } from '@/lib/env/server'

const appUrl = new URL(
  'https://reskichileweb-git-webpay-sandbox-reskichile-webs-projects.vercel.app'
)

const config: PaymentConfig = {
  enabled: true,
  environment: 'integration',
  appUrl,
  transbankTimeoutMs: 8000,
  sandboxShippingClp: 3990,
  shippingRateSource: 'sandbox_fixed',
  allowIncompleteShippingInSandbox: false,
  sandboxBuyerEmails: ['qa@example.cl'],
  inventoryReservationMinutes: 15,
  rateLimitSecret: 'r'.repeat(32),
  reconciliationJobSecret: '',
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function checkoutRequest(origin?: string): Request {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (origin) headers.set('origin', origin)
  return new Request(`${appUrl.origin}/api/checkout/quote`, {
    method: 'POST',
    headers,
    body: '{}',
  })
}

describe('checkout origin policy', () => {
  it('accepts only the exact configured origin', () => {
    expect(isTrustedCheckoutOrigin(appUrl, checkoutRequest(appUrl.origin))).toBe(true)
    expect(isTrustedCheckoutOrigin(appUrl, checkoutRequest('https://otro-proyecto.vercel.app'))).toBe(false)
    expect(isTrustedCheckoutOrigin(appUrl, checkoutRequest())).toBe(false)
  })

  it('fails forged and missing Origin closed with HTTP 403 semantics', () => {
    for (const origin of [undefined, 'https://otro-proyecto.vercel.app']) {
      try {
        assertTrustedCheckoutRequest(config, checkoutRequest(origin))
        throw new Error('expected origin rejection')
      } catch (error) {
        expect(error).toBeInstanceOf(CheckoutServiceError)
        expect(error).toMatchObject({ code: 'INVALID_ORIGIN', status: 403 })
      }
    }
  })

  it('normalizes preview diagnostics without retaining arbitrary header text', () => {
    const request = checkoutRequest('https://otro-proyecto.vercel.app')
    request.headers.set('host', 'Bad Host')
    request.headers.set('x-forwarded-host', 'Preview.Example.com, proxy.internal')

    expect(checkoutOriginDiagnostics(appUrl, request, {
      vercelBranchUrl: 'BRANCH.EXAMPLE.COM',
      vercelUrl: 'bad/path',
    })).toEqual({
      origin: 'https://otro-proyecto.vercel.app',
      host: null,
      forwardedHost: 'preview.example.com',
      appOrigin: appUrl.origin,
      vercelBranchUrl: 'branch.example.com',
      vercelUrl: null,
    })
  })

  it('logs normalized mismatch evidence only in Integration Preview', () => {
    vi.stubEnv('TRANSBANK_ENVIRONMENT', 'integration')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL_URL', 'deployment.example.com')
    vi.stubEnv('VERCEL_BRANCH_URL', 'branch.example.com')
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    expect(() => assertTrustedCheckoutRequest(config, checkoutRequest())).toThrow()
    expect(info).toHaveBeenCalledWith(
      'checkout_origin_mismatch',
      expect.objectContaining({ origin: null, appOrigin: appUrl.origin })
    )

    info.mockClear()
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(() => assertTrustedCheckoutRequest(config, checkoutRequest())).toThrow()
    expect(info).not.toHaveBeenCalled()
  })
})

describe('canonical preview navigation', () => {
  const runtime = {
    paymentEnvironment: 'integration',
    vercelEnvironment: 'preview',
    vercelUrl: 'reskichile-m2ft847df-reskichile-webs-projects.vercel.app',
    vercelBranchUrl: appUrl.hostname,
  }

  it('redirects the individual GET to the branch alias and keeps known checkout params', () => {
    const destination = canonicalPreviewNavigationRedirect(
      {
        method: 'GET',
        url: 'https://reskichile-m2ft847df-reskichile-webs-projects.vercel.app/checkout?racks=1&x-vercel-protection-bypass=secret&unknown=value',
      },
      appUrl,
      runtime
    )
    expect(destination?.toString()).toBe(`${appUrl.origin}/checkout?racks=1`)
  })

  it('does not redirect POSTs, external hosts, production, or a mismatched branch alias', () => {
    expect(canonicalPreviewNavigationRedirect({ method: 'POST', url: `${runtime.vercelUrl}/checkout` }, appUrl, runtime)).toBeNull()
    expect(canonicalPreviewNavigationRedirect({ method: 'GET', url: 'https://otro-proyecto.vercel.app/checkout' }, appUrl, runtime)).toBeNull()
    expect(canonicalPreviewNavigationRedirect({ method: 'GET', url: `https://${runtime.vercelUrl}/checkout` }, appUrl, { ...runtime, vercelEnvironment: 'production' })).toBeNull()
    expect(canonicalPreviewNavigationRedirect({ method: 'GET', url: `https://${runtime.vercelUrl}/checkout` }, appUrl, { ...runtime, vercelBranchUrl: 'otra-rama.vercel.app' })).toBeNull()
  })
})

describe('Webpay return URL', () => {
  it('carries only the automation bypass in Integration Preview', () => {
    const secret = 's'.repeat(32)
    expect(webpayReturnUrl(appUrl, 'integration', 'preview', secret)).toBe(
      `${appUrl.origin}/api/payments/webpay/return?x-vercel-protection-bypass=${secret}`
    )
  })

  it('never carries a preview bypass in Production', () => {
    expect(webpayReturnUrl(appUrl, 'production', 'production', 's'.repeat(32))).toBe(
      `${appUrl.origin}/api/payments/webpay/return`
    )
  })
})
