import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SEASON_AUTOMATIONS_ENABLED } from '@/lib/season'

const mocks = vi.hoisted(() => ({ outbox: vi.fn(), reconcile: vi.fn() }))
const secret = 'operational-secret-for-tests-1234567890'
vi.mock('@/lib/env/server', () => ({
  getCommerceJobSecret: () => 'operational-secret-for-tests-1234567890',
  getPaymentReconciliationConfig: () => ({
    reconciliationJobSecret: 'operational-secret-for-tests-1234567890',
    transbankTimeoutMs: 10000,
  }),
}))
vi.mock('@/lib/commerce/outbox-service', () => ({ processCommerceOutbox: mocks.outbox }))
vi.mock('@/lib/payments/payment-service', () => ({ reconcilePendingWebpayPayments: mocks.reconcile }))
import { POST as outbox } from '@/app/api/cron/commerce/outbox/route'
import { POST as reconcile } from '@/app/api/cron/payments/reconcile/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.outbox.mockResolvedValue({ processed: 0 })
  mocks.reconcile.mockResolvedValue({ reconciled: 0 })
})

describe('Operational jobs during the Instagram seasonal pause', () => {
  it('keeps purchase email delivery and payment recovery running', async () => {
    expect(SEASON_AUTOMATIONS_ENABLED).toBe(false)
    for (const handler of [outbox, reconcile]) {
      const result = await handler(new Request('https://www.reskichile.cl/api/cron/test', {
        method: 'POST', headers: { authorization: `Bearer ${secret}` },
      }))
      expect(result.status).toBe(200)
      expect(await result.json()).toMatchObject({ ok: true })
    }
    expect(mocks.outbox).toHaveBeenCalledWith(10)
    expect(mocks.reconcile).toHaveBeenCalledOnce()
  })

  it('still authenticates the operational jobs', async () => {
    for (const handler of [outbox, reconcile]) {
      expect((await handler(new Request('https://www.reskichile.cl/api/cron/test', { method: 'POST' }))).status).toBe(401)
    }
    expect(mocks.outbox).not.toHaveBeenCalled()
    expect(mocks.reconcile).not.toHaveBeenCalled()
  })
})
