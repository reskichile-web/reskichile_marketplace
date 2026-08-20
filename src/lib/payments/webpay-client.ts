import 'server-only'

import {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Options,
  WebpayPlus,
} from 'transbank-sdk'
import type { PaymentConfig } from '@/lib/env/server'

const TOKEN_RE = /^[A-Za-z0-9._~-]{10,128}$/

export interface WebpayInitialization {
  token: string
  url: string
}

export interface WebpayTransactionResult {
  amount: number
  status: string
  buyOrder: string
  sessionId: string
  responseCode: number | null
  authorizationCode: string | null
  paymentTypeCode: string | null
  installmentsNumber: number | null
  cardLastFour: string | null
  transactionDate: string | null
}

export interface WebpayRefundResult {
  type: 'REVERSED' | 'NULLIFIED'
  authorizationCode: string | null
  authorizationDate: string | null
  balance: number | null
  nullifiedAmount: number | null
  responseCode: number | null
}

export class WebpayResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebpayResponseError'
  }
}

function recordValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WebpayResponseError('Transbank entregó una respuesta inválida')
  }
  return value as Record<string, unknown>
}

function requiredString(
  value: unknown,
  label: string,
  maximum: number
): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum) {
    throw new WebpayResponseError('Transbank entregó ' + label + ' inválido')
  }
  return value
}

function optionalString(value: unknown, maximum: number): string | null {
  if (value == null) return null
  const normalized = String(value)
  if (!normalized || normalized.length > maximum) return null
  return normalized
}

function integerValue(value: unknown, label: string): number {
  const numberValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN

  if (!Number.isSafeInteger(numberValue)) {
    throw new WebpayResponseError('Transbank entregó ' + label + ' inválido')
  }
  return numberValue
}

function optionalInteger(value: unknown): number | null {
  if (value == null || value === '') return null
  const numberValue = Number(value)
  return Number.isSafeInteger(numberValue) ? numberValue : null
}

export function parseWebpayRefundResult(
  responseValue: unknown
): WebpayRefundResult {
  const response = recordValue(responseValue)
  const type = requiredString(response.type, 'tipo de reembolso', 10)
  if (type !== 'REVERSED' && type !== 'NULLIFIED') {
    throw new WebpayResponseError('Transbank entregó un tipo de reembolso inválido')
  }

  const authorizationDateCandidate = optionalString(
    response.authorization_date,
    64
  )
  const authorizationDate =
    authorizationDateCandidate &&
    !Number.isNaN(Date.parse(authorizationDateCandidate))
      ? new Date(authorizationDateCandidate).toISOString()
      : null

  const result: WebpayRefundResult = {
    type,
    authorizationCode: optionalString(response.authorization_code, 64),
    authorizationDate,
    balance: optionalInteger(response.balance),
    nullifiedAmount: optionalInteger(response.nullified_amount),
    responseCode: optionalInteger(response.response_code),
  }

  if (
    type === 'NULLIFIED' &&
    (result.responseCode == null ||
      result.balance == null ||
      result.balance < 0 ||
      result.nullifiedAmount == null ||
      result.nullifiedAmount <= 0)
  ) {
    throw new WebpayResponseError('Transbank entregó un reembolso incompleto')
  }

  return result
}

export function assertWebpayToken(value: unknown): string {
  if (typeof value !== 'string' || !TOKEN_RE.test(value)) {
    throw new WebpayResponseError('Token Webpay inválido')
  }
  return value
}

function buildTransaction(config: PaymentConfig): InstanceType<typeof WebpayPlus.Transaction> {
  const options =
    config.environment === 'integration'
      ? new Options(
          IntegrationCommerceCodes.WEBPAY_PLUS,
          IntegrationApiKeys.WEBPAY,
          Environment.Integration,
          config.transbankTimeoutMs
        )
      : new Options(
          config.transbankCommerceCode as string,
          config.transbankApiKeySecret as string,
          Environment.Production,
          config.transbankTimeoutMs
        )

  return new WebpayPlus.Transaction(options)
}

function expectedWebpayHost(config: PaymentConfig): string {
  return config.environment === 'integration'
    ? 'webpay3gint.transbank.cl'
    : 'webpay3g.transbank.cl'
}

export function validateWebpayRedirectUrl(
  rawUrl: unknown,
  config: PaymentConfig
): string {
  const value = requiredString(rawUrl, 'url', 500)
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new WebpayResponseError('Transbank entregó una URL inválida')
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== expectedWebpayHost(config) ||
    url.port ||
    url.pathname !== '/webpayserver/initTransaction' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new WebpayResponseError('Transbank entregó una URL no permitida')
  }

  return url.toString()
}

export async function createWebpayTransaction(
  config: PaymentConfig,
  input: {
    buyOrder: string
    sessionId: string
    amount: number
    returnUrl: string
  }
): Promise<WebpayInitialization> {
  const response = recordValue(
    await buildTransaction(config).create(
      input.buyOrder,
      input.sessionId,
      input.amount,
      input.returnUrl
    )
  )

  return {
    token: assertWebpayToken(response.token),
    url: validateWebpayRedirectUrl(response.url, config),
  }
}

export function parseWebpayTransactionResult(
  responseValue: unknown
): WebpayTransactionResult {
  const response = recordValue(responseValue)
  const cardDetail =
    response.card_detail == null ? null : recordValue(response.card_detail)

  const cardCandidate = cardDetail
    ? optionalString(cardDetail.card_number, 32)
    : null
  const cardLastFour =
    cardCandidate && /^[0-9]{4}$/.test(cardCandidate)
      ? cardCandidate
      : null

  const transactionDateCandidate = optionalString(
    response.transaction_date,
    64
  )
  const transactionDate =
    transactionDateCandidate &&
    !Number.isNaN(Date.parse(transactionDateCandidate))
      ? new Date(transactionDateCandidate).toISOString()
      : null

  return {
    amount: integerValue(response.amount, 'amount'),
    status: requiredString(response.status, 'status', 40),
    buyOrder: requiredString(response.buy_order, 'buy_order', 26),
    sessionId: requiredString(response.session_id, 'session_id', 61),
    // A transaction that never reached authorization remains INITIALIZED.
    // Transbank's status endpoint legitimately omits response_code in that
    // state, while committed responses include it.
    responseCode: optionalInteger(response.response_code),
    authorizationCode: optionalString(response.authorization_code, 64),
    paymentTypeCode: optionalString(response.payment_type_code, 8),
    installmentsNumber: optionalInteger(response.installments_number),
    cardLastFour,
    transactionDate,
  }
}

export async function commitWebpayTransaction(
  config: PaymentConfig,
  token: string
): Promise<WebpayTransactionResult> {
  const response = await buildTransaction(config).commit(assertWebpayToken(token))
  return parseWebpayTransactionResult(response)
}

export async function getWebpayTransactionStatus(
  config: PaymentConfig,
  token: string
): Promise<WebpayTransactionResult> {
  const response = await buildTransaction(config).status(assertWebpayToken(token))
  return parseWebpayTransactionResult(response)
}

export async function refundWebpayTransaction(
  config: PaymentConfig,
  token: string,
  amount: number
): Promise<WebpayRefundResult> {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new WebpayResponseError('Monto de reembolso inválido')
  }
  const response = await buildTransaction(config).refund(
    assertWebpayToken(token),
    amount
  )
  return parseWebpayRefundResult(response)
}

export function safeWebpayError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'unknown_error'

  const candidate = error as {
    name?: unknown
    code?: unknown
    response?: { status?: unknown }
  }

  const name =
    typeof candidate.name === 'string'
      ? candidate.name.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)
      : 'Error'
  const code =
    typeof candidate.code === 'string'
      ? candidate.code.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)
      : null
  const status =
    typeof candidate.response?.status === 'number'
      ? candidate.response.status
      : null

  return [name, code, status].filter((value) => value != null).join(':')
}
