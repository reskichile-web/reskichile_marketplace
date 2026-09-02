import { afterEach, describe, expect, it, vi } from 'vitest'
import { quoteStarken, StarkenError } from '@/lib/shipping/starken'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Starken official quote', () => {
  it('selects NORMAL home delivery paid through the current account', async () => {
    const fetchMock = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      if (!init?.method) {
        return new Response(JSON.stringify([
          {
            name: 'LAS CONDES',
            city: { code_dls: 1, region: { name: 'REGIÓN METROPOLITANA' } },
          },
          {
            name: 'PUERTO MONTT',
            city: { code_dls: 98, region: { name: 'REGIÓN DE LOS LAGOS' } },
          },
        ]), { status: 200 })
      }
      return new Response(JSON.stringify({
        alternativas: [
          { precio: 2800, servicio: 'NORMAL', entrega: 'AGENCIA', codigo_tipo_pago: 2 },
          { precio: 2600, servicio: 'NORMAL', entrega: 'DOMICILIO', codigo_tipo_pago: 3 },
          { precio: 4100, servicio: 'EXPRESO', entrega: 'DOMICILIO', codigo_tipo_pago: 2 },
          { precio: 3500, servicio: 'NORMAL', entrega: 'DOMICILIO', codigo_tipo_pago: 2 },
        ],
      }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const quote = await quoteStarken(
      {
        baseUrl: 'https://starken-test-one.example/integracion/',
        apiToken: 'secret-token',
        currentAccount: '19154',
        currentAccountDv: 'K',
        timeoutMs: 8000,
      },
      { region: 'Metropolitana de Santiago', commune: 'Las Condes' },
      { region: 'Región de Los Lagos', commune: 'Puerto Montt' },
      { lengthCm: 20, widthCm: 10, heightCm: 10, weightKg: 0.5 },
    )

    expect(quote).toMatchObject({
      amountClp: 3500,
      serviceCode: 'NORMAL',
      deliveryType: 'DOMICILIO',
      paymentType: 2,
      originCityCode: 1,
      destinationCityCode: 98,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer secret-token',
    })
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      origen: 1,
      destino: 98,
      bulto: 'BULTO',
      ctacte: '19154',
      ctacte_dv: 'K',
      todas_alternativas: true,
    })
  })

  it('does not silently offer pay-on-arrival as a prepaid checkout rate', async () => {
    const fetchMock = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      if (!init?.method) {
        return new Response(JSON.stringify([
          { name: 'LAS CONDES', city: { code_dls: 1 } },
          { name: 'TEMUCO', city: { code_dls: 77 } },
        ]), { status: 200 })
      }
      return new Response(JSON.stringify({
        alternativas: [
          { precio: 3200, servicio: 'NORMAL', entrega: 'DOMICILIO', codigo_tipo_pago: 3 },
        ],
      }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(quoteStarken(
      {
        baseUrl: 'https://starken-test-two.example/integracion/',
        apiToken: 'secret-token',
        currentAccount: '19154',
        currentAccountDv: 'K',
        timeoutMs: 8000,
      },
      { region: 'Metropolitana de Santiago', commune: 'Las Condes' },
      { region: 'Región de La Araucanía', commune: 'Temuco' },
      { lengthCm: 20, widthCm: 10, heightCm: 10, weightKg: 0.5 },
    )).rejects.toBeInstanceOf(StarkenError)
  })
})
