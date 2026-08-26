import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
  cleanup: vi.fn(),
  revalidate: vi.fn(),
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
    readSmallJson: (request: Request) => request.json(),
    adminErrorResponse: (error: unknown) => error instanceof MockAdminRequestError
      ? { message: error.message, status: error.status, code: error.code }
      : { message: 'No pudimos completar la operación', status: 500, code: 'INTERNAL_ERROR' },
  }
})
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => ({ from: mocks.from }),
}))
vi.mock('@/lib/instagram/story-cleanup', () => ({
  cleanupQueuedProductStories: mocks.cleanup,
}))
vi.mock('@/lib/revalidate', () => ({ revalidateProduct: mocks.revalidate }))

import { POST } from '@/app/api/admin/products/[id]/sold/route'

const productId = '96000000-0000-4000-8000-000000000001'

describe('admin product sold transition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateEq.mockResolvedValue({ error: null })
    mocks.cleanup.mockResolvedValue({ queued: 1, removed: 1, failed: 0 })
    mocks.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: productId, slug: 'scheduled-story', status: 'approved' },
            error: null,
          }),
        }),
      }),
      update: (patch: Record<string, unknown>) => {
        mocks.update(patch)
        return { eq: mocks.updateEq }
      },
    }))
  })

  it('marks the product sold and drains its Story cleanup immediately', async () => {
    const response = await POST(
      new Request(`https://www.reskichile.cl/api/admin/products/${productId}/sold`, {
        method: 'POST',
        headers: {
          Origin: 'https://www.reskichile.cl',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sale_price: 299_990.4 }),
      }),
      { params: Promise.resolve({ id: productId }) },
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'sold',
      sale_price: 299_990,
      sold_at: expect.any(String),
    }))
    expect(mocks.cleanup).toHaveBeenCalledWith(expect.objectContaining({
      productIds: [productId],
    }))
    expect(mocks.revalidate).toHaveBeenCalledWith({ id: productId, slug: 'scheduled-story' })
    expect(body.cleanup).toEqual({ queued: 1, removed: 1, failed: 0 })
  })

  it('rejects an invalid sale price before touching the product', async () => {
    const response = await POST(
      new Request(`https://www.reskichile.cl/api/admin/products/${productId}/sold`, {
        method: 'POST',
        headers: {
          Origin: 'https://www.reskichile.cl',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sale_price: -1 }),
      }),
      { params: Promise.resolve({ id: productId }) },
    )

    expect(response.status).toBe(422)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.cleanup).not.toHaveBeenCalled()
  })

  it('keeps the sold transition successful when Storage cleanup must be retried', async () => {
    mocks.cleanup.mockRejectedValueOnce(new Error('storage unavailable'))

    const response = await POST(
      new Request(`https://www.reskichile.cl/api/admin/products/${productId}/sold`, {
        method: 'POST',
        headers: {
          Origin: 'https://www.reskichile.cl',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: productId }) },
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.cleanup).toEqual({ queued: 0, removed: 0, failed: 1 })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'sold' }))
    expect(mocks.revalidate).toHaveBeenCalled()
  })
})
