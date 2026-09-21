import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: 'admin-id', email: 'admin@example.com' }),
  deriveAccessToken: vi.fn().mockReturnValue('private-order-access'),
}))

vi.mock('@/lib/admin-security', () => ({
  requireAdmin: mocks.requireAdmin,
  adminErrorResponse: (error: unknown) => ({
    message: error instanceof Error ? error.message : 'Error',
    code: 'INTERNAL_ERROR',
    status: 500,
  }),
}))

vi.mock('@/lib/commerce/checkout-service', () => ({
  deriveOrderEmailAccessToken: mocks.deriveAccessToken,
}))

vi.mock('@/lib/env/server', () => ({
  getPaymentCallbackConfig: () => ({ rateLimitSecret: 'test-secret' }),
}))

import { GET } from '@/app/api/admin/orders/[id]/view/route'

const orderId = '995a7867-b74e-4c20-8695-66df85bfa161'

describe('admin order customer view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires an admin and redirects to the protected order view', async () => {
    const response = await GET(
      new Request(`https://www.reskichile.cl/api/admin/orders/${orderId}/view`),
      { params: Promise.resolve({ id: orderId }) }
    )

    expect(mocks.requireAdmin).toHaveBeenCalledOnce()
    expect(mocks.deriveAccessToken).toHaveBeenCalledWith(
      { rateLimitSecret: 'test-secret' },
      orderId
    )
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      `https://www.reskichile.cl/checkout/resultado?orden=${orderId}&acceso=private-order-access`
    )
    expect(response.headers.get('cache-control')).toBe('no-store, private')
  })

  it('rejects malformed order ids without generating a private link', async () => {
    const response = await GET(
      new Request('https://www.reskichile.cl/api/admin/orders/not-an-order/view'),
      { params: Promise.resolve({ id: 'not-an-order' }) }
    )

    expect(response.status).toBe(422)
    expect(mocks.deriveAccessToken).not.toHaveBeenCalled()
  })
})
