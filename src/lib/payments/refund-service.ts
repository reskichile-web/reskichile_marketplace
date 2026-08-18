import 'server-only'

import { randomUUID } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPaymentConfigForEnvironment, type PaymentEnvironment } from '@/lib/env/server'
import {
  refundWebpayTransaction,
  safeWebpayError,
  type WebpayRefundResult,
} from './webpay-client'

interface RefundRequestInput {
  orderPublicId: string
  adminUserId: string
  amountClp: number
  reason: string
  idempotencyKey: string
}

interface RefundClaim {
  action: 'refund' | 'wait' | 'terminal'
  refund_id: string
  environment?: PaymentEnvironment
  token?: string
  amount_clp?: number
  state: string
}

export interface RefundResult {
  refundId: string
  state: string
  reused: boolean
}

function allowlistedProviderResponse(result: WebpayRefundResult) {
  return {
    type: result.type,
    authorization_code: result.authorizationCode,
    authorization_date: result.authorizationDate,
    balance: result.balance,
    nullified_amount: result.nullifiedAmount,
    response_code: result.responseCode,
  }
}

async function finalizeRefund(
  refundId: string,
  correlationId: string,
  outcome: 'succeeded' | 'failed' | 'uncertain',
  result: WebpayRefundResult | null,
  errorCode: string | null
): Promise<string> {
  const service = createServiceRoleClient()
  const { data, error } = await service.rpc('commerce_finalize_refund', {
    p_refund_id: refundId,
    p_correlation_id: correlationId,
    p_outcome: outcome,
    p_provider_type: result?.type ?? null,
    p_response_code: result?.responseCode ?? null,
    p_authorization_code: result?.authorizationCode ?? null,
    p_authorization_date: result?.authorizationDate ?? null,
    p_balance_clp: result?.balance ?? null,
    p_nullified_amount_clp: result?.nullifiedAmount ?? null,
    p_error_code: errorCode,
    p_provider_response: result ? allowlistedProviderResponse(result) : {},
  })
  if (error || !data) throw new Error('refund finalization failed')
  return String((data as Record<string, unknown>).state || outcome)
}

export async function requestWebpayRefund(
  input: RefundRequestInput
): Promise<RefundResult> {
  const correlationId = randomUUID()
  const service = createServiceRoleClient()
  const { data: requested, error: requestError } = await service.rpc(
    'commerce_request_refund',
    {
      p_order_public_id: input.orderPublicId,
      p_admin_user_id: input.adminUserId,
      p_amount_clp: input.amountClp,
      p_reason: input.reason,
      p_idempotency_key: input.idempotencyKey,
      p_correlation_id: correlationId,
    }
  )
  if (requestError || !requested) {
    throw new Error(requestError?.message || 'refund request failed')
  }

  const requestedRecord = requested as Record<string, unknown>
  const refundId = String(requestedRecord.refund_id)
  const { data: claimData, error: claimError } = await service.rpc(
    'commerce_claim_refund',
    { p_refund_id: refundId, p_correlation_id: correlationId }
  )
  if (claimError || !claimData) throw new Error('refund claim failed')

  const claim = claimData as unknown as RefundClaim
  if (claim.action !== 'refund') {
    return { refundId, state: claim.state, reused: true }
  }
  if (!claim.environment || !claim.token || !Number.isSafeInteger(claim.amount_clp)) {
    const state = await finalizeRefund(
      refundId,
      correlationId,
      'uncertain',
      null,
      'invalid_refund_claim'
    )
    return { refundId, state, reused: Boolean(requestedRecord.reused) }
  }

  try {
    const providerResult = await refundWebpayTransaction(
      getPaymentConfigForEnvironment(claim.environment),
      claim.token,
      claim.amount_clp as number
    )
    const succeeded =
      providerResult.type === 'REVERSED' ||
      (providerResult.type === 'NULLIFIED' && providerResult.responseCode === 0)
    const state = await finalizeRefund(
      refundId,
      correlationId,
      succeeded ? 'succeeded' : 'failed',
      providerResult,
      succeeded ? null : `provider_response_${providerResult.responseCode ?? 'unknown'}`
    )
    return { refundId, state, reused: Boolean(requestedRecord.reused) }
  } catch (error) {
    const reason = safeWebpayError(error) || 'refund_provider_uncertain'
    console.error('webpay_refund_uncertain', { correlationId, reason })
    try {
      const state = await finalizeRefund(
        refundId,
        correlationId,
        'uncertain',
        null,
        reason
      )
      return { refundId, state, reused: Boolean(requestedRecord.reused) }
    } catch {
      // The provider call may have succeeded while persistence was unavailable.
      // Never retry automatically; the processing row is durable evidence for
      // an administrator to reconcile against the Transbank portal.
      console.error('webpay_refund_persistence_uncertain', { correlationId })
      throw new Error('refund outcome requires manual reconciliation')
    }
  }
}
