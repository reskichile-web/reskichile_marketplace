import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  productStatus: 'approved',
  update: vi.fn(),
  updateEqStatus: vi.fn(),
  revalidate: vi.fn(),
}))

vi.mock('@/lib/admin-security', () => ({
  assertSameOrigin: vi.fn(),
  requireAdmin: vi.fn().mockResolvedValue({ id: 'admin-id', email: 'admin@example.com' }),
  readSmallJson: (request: Request) => request.json(),
  adminErrorResponse: (error: unknown) => ({
    message: error instanceof Error ? error.message : 'Error',
    code: 'INTERNAL_ERROR',
    status: 500,
  }),
}))

vi.mock('@/lib/revalidate', () => ({ revalidateProduct: mocks.revalidate }))

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: '92000000-0000-4000-8000-000000000001',
              slug: 'dynafit-radical',
              status: mocks.productStatus,
            },
            error: null,
          }),
        }),
      }),
      update: mocks.update,
    }),
  }),
}))

import { PATCH } from '@/app/api/admin/products/[id]/route'

const productId = '92000000-0000-4000-8000-000000000001'

function request(action: 'pause' | 'resume') {
  return new Request(`https://www.reskichile.cl/api/admin/products/${productId}`, {
    method: 'PATCH',
    headers: {
      Origin: 'https://www.reskichile.cl',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action }),
  })
}

describe('admin product pause controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.productStatus = 'approved'
    mocks.updateEqStatus.mockResolvedValue({ error: null })
    mocks.update.mockImplementation(() => ({
      eq: () => ({ eq: mocks.updateEqStatus }),
    }))
  })

  it('pauses an approved product without changing any other field', async () => {
    const response = await PATCH(request('pause'), { params: Promise.resolve({ id: productId }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, status: 'draft' })
    expect(mocks.update).toHaveBeenCalledWith({ status: 'draft' })
    expect(mocks.updateEqStatus).toHaveBeenCalledWith('status', 'approved')
    expect(mocks.revalidate).toHaveBeenCalledWith({ id: productId, slug: 'dynafit-radical' })
  })

  it('reactivates a paused product without running the approval workflow', async () => {
    mocks.productStatus = 'draft'

    const response = await PATCH(request('resume'), { params: Promise.resolve({ id: productId }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, status: 'approved' })
    expect(mocks.update).toHaveBeenCalledWith({ status: 'approved' })
    expect(mocks.updateEqStatus).toHaveBeenCalledWith('status', 'draft')
  })

  it('does not pause products in another state', async () => {
    mocks.productStatus = 'sold'

    const response = await PATCH(request('pause'), { params: Promise.resolve({ id: productId }) })

    expect(response.status).toBe(409)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
