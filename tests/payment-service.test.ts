import { describe, expect, it } from 'vitest'
import {
  fallbackForWebpayReturnKind,
  outcomeFromStatus,
} from '@/lib/payments/payment-service'
import type { WebpayTransactionResult } from '@/lib/payments/webpay-client'

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
