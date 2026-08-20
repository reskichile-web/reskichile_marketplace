import { describe, expect, it } from 'vitest'
import {
  parseWebpayRefundResult,
  parseWebpayTransactionResult,
  validateWebpayRedirectUrl,
} from '@/lib/payments/webpay-client'
import type { PaymentConfig } from '@/lib/env/server'

const config: PaymentConfig = {
  enabled: true,
  environment: 'integration',
  appUrl: new URL('http://localhost:4173'),
  transbankTimeoutMs: 8000,
  sandboxShippingClp: 3990,
  shippingRateSource: 'sandbox_fixed',
  allowIncompleteShippingInSandbox: true,
  sandboxBuyerEmails: [],
  inventoryReservationMinutes: 15,
  rateLimitSecret: 'x'.repeat(32),
  reconciliationJobSecret: 'y'.repeat(32),
}

describe('Webpay provider response validation', () => {
  it('accepts only the exact integration redirect URL', () => {
    expect(validateWebpayRedirectUrl(
      'https://webpay3gint.transbank.cl/webpayserver/initTransaction',
      config
    )).toBe('https://webpay3gint.transbank.cl/webpayserver/initTransaction')
    expect(() => validateWebpayRedirectUrl(
      'https://webpay3gint.transbank.cl/webpayserver/initTransaction?next=evil',
      config
    )).toThrow('URL no permitida')
    expect(() => validateWebpayRedirectUrl(
      'https://example.com/webpayserver/initTransaction',
      config
    )).toThrow('URL no permitida')
  })

  it('parses allowlisted authorization evidence', () => {
    expect(parseWebpayTransactionResult({
      amount: 11990,
      status: 'AUTHORIZED',
      buy_order: 'ORDER1',
      session_id: 'SESSION1',
      response_code: 0,
      authorization_code: 'ABC123',
      payment_type_code: 'VN',
      installments_number: 0,
      card_detail: { card_number: '1234' },
      transaction_date: '2026-08-18T12:00:00Z',
    })).toMatchObject({
      amount: 11990,
      status: 'AUTHORIZED',
      responseCode: 0,
      cardLastFour: '1234',
    })
  })

  it('accepts an INITIALIZED status without a response code', () => {
    expect(parseWebpayTransactionResult({
      amount: 15980,
      status: 'INITIALIZED',
      buy_order: 'ORDER2',
      session_id: 'SESSION2',
      installments_number: 0,
      transaction_date: '2026-08-20T23:11:00Z',
    })).toMatchObject({
      amount: 15980,
      status: 'INITIALIZED',
      buyOrder: 'ORDER2',
      sessionId: 'SESSION2',
      responseCode: null,
    })
  })

  it('validates both documented refund response shapes', () => {
    expect(parseWebpayRefundResult({ type: 'REVERSED' })).toEqual({
      type: 'REVERSED',
      authorizationCode: null,
      authorizationDate: null,
      balance: null,
      nullifiedAmount: null,
      responseCode: null,
    })
    expect(parseWebpayRefundResult({
      type: 'NULLIFIED',
      authorization_code: 'RF1234',
      authorization_date: '2026-08-18T12:00:00Z',
      balance: 0,
      nullified_amount: 11990,
      response_code: 0,
    })).toMatchObject({
      type: 'NULLIFIED',
      balance: 0,
      nullifiedAmount: 11990,
      responseCode: 0,
    })
    expect(() => parseWebpayRefundResult({
      type: 'NULLIFIED', response_code: 0,
    })).toThrow('reembolso incompleto')
  })
})
