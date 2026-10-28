import { describe, expect, it } from 'vitest'
import {
  fallbackForWebpayReturnKind,
  outcomeFromStatus,
} from '@/lib/payments/payment-service'
import type { WebpayTransactionResult } from '@/lib/payments/webpay-client'
import { INITIALIZED_GRACE_MS, initializedPaymentExpired } from '@/lib/payments/recovery-policy'

const initialized: WebpayTransactionResult = {
  amount: 15980,
  status: 'INITIALIZED',
  buyOrder: 'ORDER1',
  sessionId: 'SESSION1',
  responseCode: null,
  authorizationCode: null,
  paymentTypeCode: null,
  installmentsNumber: 0,
  cardLastFour: null,
  transactionDate: '2026-08-20T23:11:00.000Z',
}

describe('Webpay non-normal return recovery', () => {
  it('keeps conflicting browser returns uncertain regardless of the received fallback', () => {
    expect(fallbackForWebpayReturnKind('special', 'aborted')).toBe('uncertain')
    expect(fallbackForWebpayReturnKind('special', 'expired')).toBe('uncertain')
  })

  it('closes only provider-confirmed INITIALIZED payments after the grace period', () => {
    const context = { created_at: new Date(Date.now() - INITIALIZED_GRACE_MS - 1000).toISOString(), commit_started_at: null }
    expect(outcomeFromStatus(initialized, 'uncertain', context)).toBe('expired')
    expect(outcomeFromStatus(initialized, 'uncertain', { ...context, commit_started_at: new Date().toISOString() })).toBe('reconciliation_required')
    expect(outcomeFromStatus({ ...initialized, status: 'AUTHORIZED', responseCode: 0 }, 'uncertain', context)).toBe('authorized')
    expect(outcomeFromStatus({ ...initialized, status: 'UNKNOWN' }, 'uncertain', context)).toBe('reconciliation_required')
    expect(initializedPaymentExpired({ created_at: 'bad-date', commit_started_at: null })).toBe(false)
  })
  it('keeps abort and timeout semantics across a later reconciliation', () => {
    expect(outcomeFromStatus(
      initialized,
      fallbackForWebpayReturnKind('aborted', 'uncertain')
    )).toBe('aborted')
    expect(outcomeFromStatus(
      initialized,
      fallbackForWebpayReturnKind('timeout', 'uncertain')
    )).toBe('expired')
  })

  it('keeps special or missing context fail-closed', () => {
    expect(outcomeFromStatus(
      initialized,
      fallbackForWebpayReturnKind('special', 'uncertain')
    )).toBe('reconciliation_required')
    expect(outcomeFromStatus(
      initialized,
      fallbackForWebpayReturnKind(null, 'uncertain')
    )).toBe('reconciliation_required')
  })
})
