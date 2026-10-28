import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ admin: vi.fn(), origin: vi.fn(), rpc: vi.fn(), review: vi.fn() }))
vi.mock('@/lib/admin-security', () => ({ requireAdmin: mocks.admin, assertSameOrigin: mocks.origin, readSmallJson: (r: Request) => r.json(), adminErrorResponse: (e: Error) => ({ message: e.message, status: 403, code: 'FORBIDDEN' }) }))
vi.mock('@/lib/supabase/server', () => ({ createServiceRoleClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('@/lib/payments/payment-service', () => ({ reviewOrderPayment: mocks.review }))
import { POST } from '@/app/api/admin/orders/[id]/recovery/route'
const id = '73e24772-96fa-455b-b39a-6473599c2022'
function request(body: unknown) { return POST(new Request('https://www.reskichile.cl/api/admin/orders/'+id+'/recovery', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) }) }
beforeEach(() => { vi.clearAllMocks(); mocks.admin.mockResolvedValue({ id: 'verified-admin' }); mocks.origin.mockImplementation(() => {}); mocks.rpc.mockResolvedValue({ data: { reused: false }, error: null }); mocks.review.mockResolvedValue({ state:'expired' }) })
describe('administrator order recovery boundary', () => {
  it('rejects an untrusted origin before reading or changing a payment', async () => {
    mocks.origin.mockImplementation(() => { throw new Error('Untrusted origin') })
    expect((await request({ action:'manual_delivery', note:'Entrega personal acordada.' })).status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.review).not.toHaveBeenCalled()
  })
  it('uses the verified administrator and rechecks Webpay before arranging delivery', async () => {
    expect((await request({ action:'manual_delivery', note:'Entrega personal acordada.', adminUserId:'attacker' })).status).toBe(200)
    expect(mocks.review).toHaveBeenCalledWith(id,'verified-admin')
    expect(mocks.rpc).toHaveBeenCalledWith('commerce_admin_set_manual_delivery',expect.objectContaining({ p_admin_user_id:'verified-admin', p_order_public_id:id }))
    expect(mocks.review.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0])
  })
  it.each([0,7990.5,'7990',-7990])('rejects invalid manual amounts: %s',async amountClp => {
    expect((await request({ action:'manual_payment', method:'bank_transfer', amountClp, reference:'CONFIRMED' })).status).toBe(422)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('records evidence separately without inventing a provider authorization', async () => {
    await request({ action:'manual_payment', method:'bank_transfer', amountClp:7990, reference:'Confirmed transfer' })
    expect(mocks.rpc).toHaveBeenCalledWith('commerce_admin_record_manual_payment',expect.objectContaining({ p_method:'bank_transfer', p_amount_clp:7990, p_reference:'Confirmed transfer', p_notify_buyer:true }))
    expect(mocks.rpc).not.toHaveBeenCalledWith('commerce_finalize_webpay',expect.anything())
  })
  it('returns a conflict if the provider state or stock prevents conversion',async () => {
    mocks.rpc.mockResolvedValue({ data:null,error:{ message:'resolve provider payment before changing delivery' } })
    expect((await request({ action:'manual_delivery',note:'Entrega personal acordada.' })).status).toBe(409)
  })
})
