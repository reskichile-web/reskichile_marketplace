import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ admin: vi.fn(), from: vi.fn(), rpc: vi.fn(), range: vi.fn() }))
vi.mock('@/lib/admin-security', () => ({ requireAdmin: mocks.admin, adminErrorResponse: () => ({ message: 'Error',code: 'ERROR',status: 500 }) }))
vi.mock('@/lib/supabase/server', () => ({ createServiceRoleClient: () => ({ from: mocks.from,rpc: mocks.rpc }) }))
vi.mock('@/lib/env/server', () => ({ getRefundConfig: () => ({ enabled: false }) }))
import { GET } from '@/app/api/admin/orders/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.admin.mockResolvedValue({ id: 'admin' })
  mocks.range.mockResolvedValue({ data: [{ public_id: 'rejected-order',payment_status: 'rejected',total_clp: 25960,payment_attempts: [],refunds: [] }],count: 31,error: null })
  mocks.from.mockReturnValue({ select: () => ({ order: () => ({ range: mocks.range }) }) })
  mocks.rpc.mockResolvedValue({ data: [{ paid_order_count: 3,collected_clp: 131350 }],error: null })
})

describe('global order footer totals', () => {
  it('returns global receipts even when the visible page contains only a rejected order', async () => {
    const response = await GET(new Request('https://www.reskichile.cl/api/admin/orders?offset=30'))
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(mocks.range).toHaveBeenCalledWith(30,59)
    expect(data.orders).toHaveLength(1)
    expect(data.totals).toEqual({ paidOrderCount: 3,collectedClp: 131350 })
    expect(response.headers.get('cache-control')).toBe('no-store, private')
  })
  it('does not expose receipts before administrator authorization', async () => {
    mocks.admin.mockRejectedValue(new Error('Not an administrator'))
    await GET(new Request('https://www.reskichile.cl/api/admin/orders'))
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('reports a failed aggregate instead of displaying a fabricated zero', async () => {
    mocks.rpc.mockResolvedValue({ data: null,error: { message: 'aggregate unavailable' } })
    const response = await GET(new Request('https://www.reskichile.cl/api/admin/orders'))
    expect(response.status).toBe(500)
    expect((await response.json()).totals).toBeUndefined()
  })
})
