import { describe, expect, it } from 'vitest'
import { quoteCheckout } from '@/lib/commerce/checkout-service'
import type { CheckoutInput } from '@/lib/commerce/checkout-validation'
import type { PaymentConfig } from '@/lib/env/server'

const config: PaymentConfig = {
  enabled: true,
  environment: 'integration',
  appUrl: new URL('https://sandbox.reskichile.cl'),
  transbankTimeoutMs: 8000,
  sandboxShippingClp: 3990,
  shippingRateSource: 'sandbox_fixed',
  allowIncompleteShippingInSandbox: false,
  sandboxBuyerEmails: ['qa@example.cl'],
  inventoryReservationMinutes: 15,
  rateLimitSecret: 'r'.repeat(32),
  reconciliationJobSecret: '',
}

const input: CheckoutInput = {
  productIds: [],
  rackItems: [{ slug: 'ski-rack-filamento', size: 'M', quantity: 1 }],
  idempotencyKey: '4d9bd7dc-1877-4cf6-9c9e-cc8a41cad19f',
  buyer: {
    name: 'Comprador Sandbox',
    email: 'otra-persona@example.cl',
    phone: '+56912345678',
  },
  delivery: {
    method: 'home',
    region: 'Metropolitana de Santiago',
    commune: 'Las Condes',
    street: 'Avenida Apoquindo',
    number: '3000',
    extra: null,
    pickupPointId: null,
  },
  couponCode: null,
}

describe('sandbox checkout access', () => {
  it('rejects a buyer outside the deployed sandbox allowlist before reading stock', async () => {
    await expect(quoteCheckout(config, input)).rejects.toMatchObject({
      code: 'SANDBOX_BUYER_NOT_ALLOWED',
      status: 403,
    })
  })
})
