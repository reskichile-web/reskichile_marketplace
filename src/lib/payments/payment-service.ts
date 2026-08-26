import 'server-only'

import { randomUUID } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { cleanupQueuedProductStories } from '@/lib/instagram/story-cleanup'
import {
  getPaymentConfigForEnvironment,
  type PaymentConfig,
  type PaymentEnvironment,
} from '@/lib/env/server'
import type { WebpayReturn } from './return-parser'
import {
  commitWebpayTransaction,
  getWebpayTransactionStatus,
  safeWebpayError,
  type WebpayTransactionResult,
} from './webpay-client'

type PaymentOutcome =
  | 'authorized'
  | 'rejected'
  | 'aborted'
  | 'expired'
  | 'reconciliation_required'

type PaymentAction = 'commit' | 'status' | 'wait' | 'terminal'

interface PaymentAttemptCore {
  id: string
  order_id: string
  public_id: string
  environment: PaymentEnvironment
  state: string
  amount_clp: number
  buy_order: string
  session_id: string
}

interface PaymentAttempt extends PaymentAttemptCore {
  transbank_token: string | null
}

interface ClaimedPayment extends PaymentAttemptCore {
  action: PaymentAction
  token: string | null
  webpay_return_kind: 'aborted' | 'timeout' | 'special' | null
}

interface FinalizedPayment {
  public_id: string
  order_status: string
  payment_status: string
  attempt_state: string
  reused: boolean
}

export interface PaymentReturnResult {
  publicId: string | null
  state: string
}

export interface ReconciliationSummary {
  expiredReservations: number
  candidates: number
  claimed: number
  finalized: number
  deferred: number
  failed: number
}

function confirmedAuthorization(result: WebpayTransactionResult): boolean {
  return result.status === 'AUTHORIZED' && result.responseCode === 0
}

function outcomeFromCommit(result: WebpayTransactionResult): PaymentOutcome {
  if (confirmedAuthorization(result)) return 'authorized'
  if (['FAILED', 'REVERSED', 'NULLIFIED'].includes(result.status)) {
    return 'rejected'
  }
  return 'reconciliation_required'
}

export function outcomeFromStatus(
  result: WebpayTransactionResult,
  fallback: 'aborted' | 'expired' | 'uncertain'
): PaymentOutcome {
  if (confirmedAuthorization(result)) return 'authorized'

  if (result.status === 'INITIALIZED') {
    if (fallback === 'aborted') return 'aborted'
    if (fallback === 'expired') return 'expired'
    return 'reconciliation_required'
  }

  if (['FAILED', 'REVERSED', 'NULLIFIED'].includes(result.status)) {
    return 'rejected'
  }

  return 'reconciliation_required'
}

export function fallbackForWebpayReturnKind(
  returnKind: ClaimedPayment['webpay_return_kind'],
  fallback: 'aborted' | 'expired' | 'uncertain'
): 'aborted' | 'expired' | 'uncertain' {
  if (returnKind === 'aborted') return 'aborted'
  if (returnKind === 'timeout') return 'expired'
  return fallback
}

function providerConfig(attempt: Pick<PaymentAttemptCore, 'environment'>): PaymentConfig {
  return getPaymentConfigForEnvironment(attempt.environment)
}

async function orderPublicId(orderId: string): Promise<string | null> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('orders')
    .select('public_id')
    .eq('id', orderId)
    .maybeSingle()
  return data?.public_id ? String(data.public_id) : null
}

async function findAttempt(
  returned: Exclude<WebpayReturn, { kind: 'normal' }>
): Promise<PaymentAttempt | null> {
  const supabase = createServiceRoleClient()
  let query = supabase
    .from('payment_attempts')
    .select(
      'id, order_id, environment, state, amount_clp, buy_order, session_id, transbank_token'
    )
    .eq('buy_order', returned.buyOrder)
    .eq('session_id', returned.sessionId)

  if (returned.kind === 'aborted' || returned.kind === 'special') {
    query = query.eq(
      'transbank_token',
      returned.kind === 'aborted' ? returned.token : returned.tbkToken
    )
  }

  const { data, error } = await query.maybeSingle()
  if (error || !data) return null

  const publicId = await orderPublicId(String(data.order_id))
  if (!publicId) return null

  return {
    ...(data as unknown as Omit<PaymentAttempt, 'public_id'>),
    public_id: publicId,
  }
}

async function findAttemptByToken(token: string): Promise<PaymentAttempt | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('payment_attempts')
    .select(
      'id, order_id, environment, state, amount_clp, buy_order, session_id, transbank_token'
    )
    .eq('transbank_token', token)
    .maybeSingle()

  if (error || !data) return null
  const publicId = await orderPublicId(String(data.order_id))
  if (!publicId) return null

  return {
    ...(data as unknown as Omit<PaymentAttempt, 'public_id'>),
    public_id: publicId,
  }
}

async function finalize(
  attempt: PaymentAttemptCore,
  outcome: PaymentOutcome,
  correlationId: string,
  result: WebpayTransactionResult | null
): Promise<FinalizedPayment> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('commerce_finalize_webpay', {
    p_attempt_id: attempt.id,
    p_outcome: outcome,
    p_amount_clp: result?.amount ?? null,
    p_buy_order: result?.buyOrder ?? null,
    p_session_id: result?.sessionId ?? null,
    p_tbk_status: result?.status ?? null,
    p_response_code: result?.responseCode ?? null,
    p_authorization_code: result?.authorizationCode ?? null,
    p_payment_type_code: result?.paymentTypeCode ?? null,
    p_installments_number: result?.installmentsNumber ?? null,
    p_card_last_four: result?.cardLastFour ?? null,
    p_transaction_date: result?.transactionDate ?? null,
    p_correlation_id: correlationId,
  })

  if (error || !data) throw new Error('payment finalization failed')
  const finalized = data as unknown as FinalizedPayment
  if (finalized.order_status === 'paid' || finalized.attempt_state === 'authorized') {
    try {
      await cleanupQueuedProductStories({ service: supabase })
    } catch {
      // Payment finalization is already committed. The cleanup queue remains
      // available for the next reconciliation or Instagram cron invocation.
      console.error('instagram_story_cleanup_deferred', { correlationId })
    }
  }
  return finalized
}

async function markForReconciliation(
  attemptId: string,
  correlationId: string,
  reason: string
): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.rpc('commerce_mark_webpay_reconciliation', {
    p_attempt_id: attemptId,
    p_correlation_id: correlationId,
    p_reason: reason.slice(0, 120),
  })

  if (error) {
    console.error('webpay_reconciliation_schedule_failed', { correlationId })
  }
}

async function recordNonNormalReturn(
  attemptId: string,
  returnKind: 'aborted' | 'timeout' | 'special',
  correlationId: string
): Promise<void> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc(
    'commerce_record_webpay_return_context',
    {
      p_attempt_id: attemptId,
      p_return_kind: returnKind,
      p_correlation_id: correlationId,
    }
  )

  if (error || !data) {
    throw new Error('payment return context persistence failed')
  }
}

async function statusWithoutThrow(
  config: PaymentConfig,
  token: string,
  correlationId: string
): Promise<WebpayTransactionResult | null> {
  try {
    return await getWebpayTransactionStatus(config, token)
  } catch (error) {
    console.error('webpay_status_failed', {
      correlationId,
      reason: safeWebpayError(error),
    })
    return null
  }
}

async function finalizeOrSchedule(
  attempt: PaymentAttemptCore,
  outcome: PaymentOutcome,
  correlationId: string,
  result: WebpayTransactionResult | null
): Promise<PaymentReturnResult> {
  try {
    const finalized = await finalize(attempt, outcome, correlationId, result)
    return { publicId: finalized.public_id, state: finalized.attempt_state }
  } catch (error) {
    await markForReconciliation(
      attempt.id,
      correlationId,
      safeWebpayError(error) || 'finalization_failed'
    )
    return { publicId: attempt.public_id, state: 'reconciliation_required' }
  }
}

async function processClaimedStatus(
  attempt: ClaimedPayment,
  correlationId: string,
  fallback: 'aborted' | 'expired' | 'uncertain'
): Promise<PaymentReturnResult> {
  if (!attempt.token) {
    await markForReconciliation(attempt.id, correlationId, 'missing_webpay_token')
    return { publicId: attempt.public_id, state: 'reconciliation_required' }
  }

  const result = await statusWithoutThrow(
    providerConfig(attempt),
    attempt.token,
    correlationId
  )

  if (!result) {
    await markForReconciliation(attempt.id, correlationId, 'status_unavailable')
    return { publicId: attempt.public_id, state: 'reconciliation_required' }
  }

  return finalizeOrSchedule(
    attempt,
    outcomeFromStatus(
      result,
      fallbackForWebpayReturnKind(attempt.webpay_return_kind, fallback)
    ),
    correlationId,
    result
  )
}

async function processNormalReturn(
  token: string,
  correlationId: string
): Promise<PaymentReturnResult> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('commerce_claim_webpay_processing', {
    p_token: token,
    p_correlation_id: correlationId,
  })

  if (error) throw new Error('payment claim failed')

  if (!data) {
    const existing = await findAttemptByToken(token)
    return {
      publicId: existing?.public_id || null,
      state: existing?.state || 'not_found',
    }
  }

  const attempt = data as unknown as ClaimedPayment
  if (attempt.action === 'terminal' || attempt.action === 'wait') {
    return { publicId: attempt.public_id, state: attempt.state }
  }
  if (attempt.action === 'status') {
    return processClaimedStatus(attempt, correlationId, 'uncertain')
  }
  if (attempt.action !== 'commit' || !attempt.token) {
    await markForReconciliation(attempt.id, correlationId, 'invalid_claim_action')
    return { publicId: attempt.public_id, state: 'reconciliation_required' }
  }

  const config = providerConfig(attempt)
  try {
    const result = await commitWebpayTransaction(config, attempt.token)
    return finalizeOrSchedule(
      attempt,
      outcomeFromCommit(result),
      correlationId,
      result
    )
  } catch (error) {
    console.error('webpay_commit_failed', {
      correlationId,
      reason: safeWebpayError(error),
    })

    // Once commit_started_at exists the operation is never repeated blindly.
    // A status lookup can safely recover a provider response that was lost.
    const status = await statusWithoutThrow(config, attempt.token, correlationId)
    if (status) {
      return finalizeOrSchedule(
        attempt,
        outcomeFromStatus(status, 'uncertain'),
        correlationId,
        status
      )
    }

    await markForReconciliation(
      attempt.id,
      correlationId,
      safeWebpayError(error) || 'commit_uncertain'
    )
    return { publicId: attempt.public_id, state: 'reconciliation_required' }
  }
}

async function processNonNormalReturn(
  returned: Exclude<WebpayReturn, { kind: 'normal' }>,
  correlationId: string
): Promise<PaymentReturnResult> {
  const attempt = await findAttempt(returned)
  if (!attempt) return { publicId: null, state: 'not_found' }

  if (
    ['authorized', 'rejected', 'aborted', 'expired', 'initialization_failed'].includes(
      attempt.state
    )
  ) {
    return { publicId: attempt.public_id, state: attempt.state }
  }

  try {
    await recordNonNormalReturn(attempt.id, returned.kind, correlationId)
  } catch (error) {
    await markForReconciliation(
      attempt.id,
      correlationId,
      safeWebpayError(error) || 'return_context_persistence_failed'
    )
    return { publicId: attempt.public_id, state: 'reconciliation_required' }
  }

  if (!attempt.transbank_token) {
    await markForReconciliation(
      attempt.id,
      correlationId,
      'missing_webpay_token_after_non_normal_return'
    )
    return { publicId: attempt.public_id, state: 'reconciliation_required' }
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('commerce_claim_webpay_status', {
    p_token: attempt.transbank_token,
    p_correlation_id: correlationId,
  })
  if (error) throw new Error('payment status claim failed')
  if (!data) return { publicId: attempt.public_id, state: attempt.state }

  const claimed = data as unknown as ClaimedPayment
  if (claimed.action === 'terminal' || claimed.action === 'wait') {
    return { publicId: claimed.public_id, state: claimed.state }
  }

  if (returned.kind === 'special') {
    await markForReconciliation(claimed.id, correlationId, 'special_return')
    return { publicId: claimed.public_id, state: 'reconciliation_required' }
  }

  return processClaimedStatus(
    claimed,
    correlationId,
    returned.kind === 'aborted' ? 'aborted' : 'expired'
  )
}

export async function processWebpayReturn(
  _currentConfig: PaymentConfig,
  returned: WebpayReturn
): Promise<PaymentReturnResult> {
  const correlationId = randomUUID()
  if (returned.kind === 'normal') {
    return processNormalReturn(returned.token, correlationId)
  }
  return processNonNormalReturn(returned, correlationId)
}

export async function reconcilePendingWebpayPayments(
  config: PaymentConfig,
  limit = 20
): Promise<ReconciliationSummary> {
  const supabase = createServiceRoleClient()
  const summary: ReconciliationSummary = {
    expiredReservations: 0,
    candidates: 0,
    claimed: 0,
    finalized: 0,
    deferred: 0,
    failed: 0,
  }

  const { data: expired } = await supabase.rpc(
    'commerce_expire_checkout_reservations',
    { p_limit: Math.max(1, Math.min(limit * 5, 500)) }
  )
  summary.expiredReservations = Number(expired || 0)

  const { data: rows, error } = await supabase
    .from('payment_attempts')
    .select('id')
    .eq('environment', config.environment)
    .in('state', ['processing', 'reconciliation_required'])
    .order('next_reconcile_at', { ascending: true, nullsFirst: true })
    .limit(Math.max(1, Math.min(limit, 100)))

  if (error) throw new Error('payment reconciliation query failed')
  summary.candidates = rows?.length || 0

  for (const row of rows || []) {
    const correlationId = randomUUID()
    const { data: claimed, error: claimError } = await supabase.rpc(
      'commerce_claim_webpay_reconciliation',
      {
        p_attempt_id: row.id,
        p_correlation_id: correlationId,
      }
    )

    if (claimError) {
      summary.failed++
      continue
    }
    if (!claimed) {
      summary.deferred++
      continue
    }

    const attempt = claimed as unknown as ClaimedPayment
    if (attempt.action !== 'status') {
      summary.deferred++
      continue
    }
    summary.claimed++

    try {
      const result = await processClaimedStatus(
        attempt,
        correlationId,
        'uncertain'
      )
      if (result.state === 'reconciliation_required') summary.deferred++
      else summary.finalized++
    } catch (reconcileError) {
      await markForReconciliation(
        attempt.id,
        correlationId,
        safeWebpayError(reconcileError) || 'reconciliation_failed'
      )
      summary.failed++
    }
  }

  return summary
}
