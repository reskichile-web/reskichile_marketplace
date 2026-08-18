import 'server-only'

import { assertWebpayToken, WebpayResponseError } from './webpay-client'

const BUY_ORDER_RE = /^[A-Za-z0-9_-]{1,26}$/
const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,61}$/

export type WebpayReturn =
  | { kind: 'normal'; token: string }
  | {
      kind: 'timeout'
      buyOrder: string
      sessionId: string
    }
  | {
      kind: 'aborted'
      token: string
      buyOrder: string
      sessionId: string
    }
  | {
      kind: 'special'
      tokenWs: string
      tbkToken: string
      buyOrder: string
      sessionId: string
    }

function optionalValue(
  values: URLSearchParams,
  name: string,
  maximum: number
): string | null {
  const value = values.get(name)
  if (value == null || value === '') return null
  if (value.length > maximum || /[\u0000-\u001F\u007F]/.test(value)) {
    throw new WebpayResponseError('Retorno Webpay inválido')
  }
  return value
}

function requireOrderAndSession(
  buyOrder: string | null,
  sessionId: string | null
): { buyOrder: string; sessionId: string } {
  if (
    !buyOrder ||
    !sessionId ||
    !BUY_ORDER_RE.test(buyOrder) ||
    !SESSION_ID_RE.test(sessionId)
  ) {
    throw new WebpayResponseError('Retorno Webpay sin correlación válida')
  }
  return { buyOrder, sessionId }
}

export function parseWebpayReturn(values: URLSearchParams): WebpayReturn {
  const tokenWsRaw = optionalValue(values, 'token_ws', 128)
  const tbkTokenRaw = optionalValue(values, 'TBK_TOKEN', 128)
  const buyOrder = optionalValue(values, 'TBK_ORDEN_COMPRA', 26)
  const sessionId = optionalValue(values, 'TBK_ID_SESION', 61)

  if (tokenWsRaw && !tbkTokenRaw && !buyOrder && !sessionId) {
    return { kind: 'normal', token: assertWebpayToken(tokenWsRaw) }
  }

  if (!tokenWsRaw && !tbkTokenRaw) {
    return {
      kind: 'timeout',
      ...requireOrderAndSession(buyOrder, sessionId),
    }
  }

  if (!tokenWsRaw && tbkTokenRaw) {
    return {
      kind: 'aborted',
      token: assertWebpayToken(tbkTokenRaw),
      ...requireOrderAndSession(buyOrder, sessionId),
    }
  }

  if (tokenWsRaw && tbkTokenRaw) {
    return {
      kind: 'special',
      tokenWs: assertWebpayToken(tokenWsRaw),
      tbkToken: assertWebpayToken(tbkTokenRaw),
      ...requireOrderAndSession(buyOrder, sessionId),
    }
  }

  throw new WebpayResponseError('Retorno Webpay no reconocido')
}

export async function webpayReturnValues(request: Request): Promise<URLSearchParams> {
  if (request.url.length > 4096) {
    throw new WebpayResponseError('Retorno Webpay demasiado grande')
  }
  const url = new URL(request.url)
  const values = new URLSearchParams(url.searchParams)

  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') || ''
    const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase()
    if (mediaType !== 'application/x-www-form-urlencoded') {
      throw new WebpayResponseError('Content-Type de retorno no permitido')
    }

    const contentLength = Number(request.headers.get('content-length') || '0')
    if (Number.isFinite(contentLength) && contentLength > 4096) {
      throw new WebpayResponseError('Retorno Webpay demasiado grande')
    }

    const reader = request.body?.getReader()
    if (!reader) throw new WebpayResponseError('Retorno Webpay vacío')
    const chunks: Uint8Array[] = []
    let received = 0
    while (true) {
      const part = await reader.read()
      if (part.done) break
      received += part.value.byteLength
      if (received > 4096) {
        await reader.cancel()
        throw new WebpayResponseError('Retorno Webpay demasiado grande')
      }
      chunks.push(part.value)
    }

    const bytes = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    const bodyValues = new URLSearchParams(new TextDecoder().decode(bytes))
    for (const name of ['token_ws', 'TBK_TOKEN', 'TBK_ORDEN_COMPRA', 'TBK_ID_SESION']) {
      if (bodyValues.getAll(name).length > 1 || (values.has(name) && bodyValues.has(name))) {
        throw new WebpayResponseError('Retorno Webpay con parámetros duplicados')
      }
    }
    bodyValues.forEach((value, key) => {
      if (!values.has(key)) values.set(key, value)
    })
  }

  for (const name of ['token_ws', 'TBK_TOKEN', 'TBK_ORDEN_COMPRA', 'TBK_ID_SESION']) {
    if (values.getAll(name).length > 1) {
      throw new WebpayResponseError('Retorno Webpay con parámetros duplicados')
    }
  }

  return values
}
