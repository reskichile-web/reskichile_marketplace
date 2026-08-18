import { describe, expect, it } from 'vitest'
import {
  parseWebpayReturn,
  webpayReturnValues,
} from '@/lib/payments/return-parser'

const token = 'token_ws_1234567890'
const tbkToken = 'tbk_token_1234567890'

describe('Webpay return parsing', () => {
  it('distinguishes normal, timeout, aborted and special returns', () => {
    expect(parseWebpayReturn(new URLSearchParams({ token_ws: token }))).toEqual({
      kind: 'normal', token,
    })
    expect(parseWebpayReturn(new URLSearchParams({
      TBK_ORDEN_COMPRA: 'ORDER1',
      TBK_ID_SESION: 'SESSION1',
    }))).toEqual({ kind: 'timeout', buyOrder: 'ORDER1', sessionId: 'SESSION1' })
    expect(parseWebpayReturn(new URLSearchParams({
      TBK_TOKEN: tbkToken,
      TBK_ORDEN_COMPRA: 'ORDER1',
      TBK_ID_SESION: 'SESSION1',
    }))).toEqual({
      kind: 'aborted', token: tbkToken, buyOrder: 'ORDER1', sessionId: 'SESSION1',
    })
    expect(parseWebpayReturn(new URLSearchParams({
      token_ws: token,
      TBK_TOKEN: tbkToken,
      TBK_ORDEN_COMPRA: 'ORDER1',
      TBK_ID_SESION: 'SESSION1',
    }))).toEqual({
      kind: 'special', tokenWs: token, tbkToken, buyOrder: 'ORDER1', sessionId: 'SESSION1',
    })
  })

  it('rejects duplicate correlation parameters across query and form body', async () => {
    const request = new Request(
      'https://www.reskichile.cl/api/payments/webpay/return?token_ws=' + token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token_ws: token }),
      }
    )
    await expect(webpayReturnValues(request)).rejects.toThrow('parámetros duplicados')
  })

  it('rejects unexpected content types and oversized bodies', async () => {
    const jsonRequest = new Request(
      'https://www.reskichile.cl/api/payments/webpay/return',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
    )
    await expect(webpayReturnValues(jsonRequest)).rejects.toThrow('Content-Type')

    const largeRequest = new Request(
      'https://www.reskichile.cl/api/payments/webpay/return',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'x='.padEnd(5000, 'a'),
      }
    )
    await expect(webpayReturnValues(largeRequest)).rejects.toThrow('demasiado grande')
  })
})
