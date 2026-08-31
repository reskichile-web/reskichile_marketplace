import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sendReminder: vi.fn(),
  service: {},
}))

vi.mock('@/lib/admin-security', () => {
  class MockAdminRequestError extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly code: string,
    ) {
      super(message)
    }
  }

  return {
    AdminRequestError: MockAdminRequestError,
    assertSameOrigin: vi.fn(),
    requireAdmin: vi.fn().mockResolvedValue({ id: 'admin-id', email: 'admin@example.com' }),
    adminErrorResponse: (error: unknown) => error instanceof MockAdminRequestError
      ? { message: error.message, status: error.status, code: error.code }
      : { message: 'No pudimos completar la operación', status: 500, code: 'INTERNAL_ERROR' },
  }
})
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => mocks.service,
}))
vi.mock('@/lib/sale-reminder-email', () => ({
  sendSaleReminderForProductId: mocks.sendReminder,
}))

import { POST } from '@/app/api/admin/products/[id]/sale-reminder/route'

const productId = '96000000-0000-4000-8000-000000000001'

function request() {
  return new Request(`https://www.reskichile.cl/api/admin/products/${productId}/sale-reminder`, {
    method: 'POST',
    headers: { Origin: 'https://www.reskichile.cl' },
  })
}

describe('admin sale reminder route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sendReminder.mockResolvedValue({
      ok: true,
      recipient: 'seller@example.com',
      sentAt: '2026-08-31T12:00:00.000Z',
      trackingUpdated: true,
    })
  })

  it('sends through the same shared sender used by the cron', async () => {
    const response = await POST(request(), { params: Promise.resolve({ id: productId }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.sendReminder).toHaveBeenCalledWith(mocks.service, productId)
    expect(body).toEqual({
      ok: true,
      sentAt: '2026-08-31T12:00:00.000Z',
      trackingUpdated: true,
    })
  })

  it('returns the delivery failure without claiming success', async () => {
    mocks.sendReminder.mockResolvedValue({
      ok: false,
      code: 'EMAIL_SEND_FAILED',
      error: 'No pudimos enviar el correo',
    })

    const response = await POST(request(), { params: Promise.resolve({ id: productId }) })

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      error: 'No pudimos enviar el correo',
      code: 'EMAIL_SEND_FAILED',
    })
  })
})
