import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), commit: vi.fn(), status: vi.fn(), cleanup: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServiceRoleClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }))
vi.mock('@/lib/env/server', () => ({ getPaymentConfigForEnvironment: () => ({ environment: 'production' }) }))
vi.mock('@/lib/instagram/story-cleanup', () => ({ cleanupQueuedProductStories: mocks.cleanup }))
vi.mock('@/lib/payments/webpay-client', () => ({ commitWebpayTransaction: mocks.commit, getWebpayTransactionStatus: mocks.status, safeWebpayError: () => 'provider_error' }))
import { processWebpayReturn, reconcilePendingWebpayPayments } from '@/lib/payments/payment-service'
import type { PaymentConfig } from '@/lib/env/server'

const attempt = { id: 'attempt', order_id: 'order', public_id: 'public', environment: 'production', state: 'reconciliation_required', action: 'status', token: 'stored-token', transbank_token: 'stored-token', amount_clp: 11480, buy_order: 'BUY', session_id: 'SESSION', webpay_return_kind: 'special', created_at: new Date().toISOString(), commit_started_at: null }
const initialized = { status: 'INITIALIZED', responseCode: null, amount: 11480, buyOrder: 'BUY', sessionId: 'SESSION', authorizationCode: null, paymentTypeCode: null, installmentsNumber: 0, cardLastFour: null, transactionDate: new Date().toISOString() }
const returned = { kind: 'special' as const, tokenWs: 'other-token', tbkToken: 'stored-token', buyOrder: 'BUY', sessionId: 'SESSION' }
let filters: Array<[string, ...unknown[]]> = []
let queryRows: unknown[] = []
let claimed = { ...attempt }

beforeEach(() => {
  vi.clearAllMocks(); filters = []; queryRows = []; claimed = { ...attempt }
  mocks.status.mockResolvedValue(initialized)
  mocks.from.mockImplementation((table: string) => {
    const q: Record<string, unknown> = {}
    for (const method of ['select','eq','in','is','lte','or','order','limit']) q[method] = (...args: unknown[]) => { filters.push([method,...args]); return q }
    q.maybeSingle = async () => ({ data: table === 'orders' ? { public_id: 'public' } : attempt, error: null })
    q.then = (resolve: (r: unknown) => unknown) => Promise.resolve({ data: queryRows, error: null }).then(resolve)
    return q
  })
  mocks.rpc.mockImplementation(async (name: string, params: Record<string, unknown>) => {
    if (name === 'commerce_record_webpay_return_context') return { data: 'special', error: null }
    if (name.startsWith('commerce_claim_webpay')) return { data: claimed, error: null }
    if (name === 'commerce_finalize_webpay') return { data: { public_id: 'public', attempt_state: params.p_outcome }, error: null }
    return { data: 0, error: null }
  })
})

describe('provider recovery execution', () => {
  it('queries special returns immediately without ever committing them', async () => {
    const result = await processWebpayReturn({} as PaymentConfig, returned)
    expect(result.state).toBe('reconciliation_required')
    expect(mocks.status).toHaveBeenCalledWith({ environment: 'production' }, 'stored-token')
  })
  it('keeps a contradictory abort special rather than closing an uncertain payment', async () => {
    await processWebpayReturn({} as PaymentConfig, { kind: 'aborted', token: 'stored-token', buyOrder: 'BUY', sessionId: 'SESSION' })
    expect(mocks.rpc).toHaveBeenCalledWith('commerce_finalize_webpay', expect.objectContaining({ p_outcome: 'reconciliation_required' }))
    expect(mocks.commit).not.toHaveBeenCalled()
  })
  it('preserves authorization even after a special browser return', async () => {
    mocks.status.mockResolvedValue({ ...initialized, status: 'AUTHORIZED', responseCode: 0 })
    expect((await processWebpayReturn({} as PaymentConfig, returned)).state).toBe('authorized')
    expect(mocks.commit).not.toHaveBeenCalled()
  })
  it('never releases a reservation after an unavailable provider response', async () => {
    mocks.status.mockRejectedValue(new Error('provider timeout'))
    expect((await processWebpayReturn({} as PaymentConfig, returned)).state).toBe('reconciliation_required')
    expect(mocks.rpc).not.toHaveBeenCalledWith('commerce_finalize_webpay', expect.anything())
    expect(mocks.rpc).toHaveBeenCalledWith('commerce_mark_webpay_reconciliation', expect.objectContaining({ p_reason: 'status_unavailable' }))
    expect(mocks.commit).not.toHaveBeenCalled()
  })
  it('only takes due, unpaused work without an active processing lease', async () => {
    await reconcilePendingWebpayPayments({ environment: 'production' } as PaymentConfig, 5)
    expect(filters).toContainEqual(['is','reconciliation_paused_at',null])
    expect(filters).toContainEqual(['lte','next_reconcile_at',expect.any(String)])
    expect(filters).toContainEqual(['or',expect.stringContaining('processing_lease_until.is.null')])
  })
})
