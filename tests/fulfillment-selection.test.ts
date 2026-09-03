import { describe, expect, it } from 'vitest'
import {
  selectBestShippingRate,
  type TableShippingRateCandidate,
} from '@/lib/commerce/fulfillment-selection'

function rate(
  overrides: Partial<TableShippingRateCandidate>,
): TableShippingRateCandidate {
  return {
    id: 'regional',
    originCode: 'las_condes',
    serviceCode: 'starken_flat_xs',
    amountClp: 3490,
    minDeliveryDays: null,
    maxDeliveryDays: null,
    zonePriority: 50,
    zoneRegion: 'Metropolitana de Santiago',
    zoneCommune: null,
    ...overrides,
  }
}

describe('table shipping rate selection', () => {
  it('prefers the exact same-commune rate over its regional rate', () => {
    const selected = selectBestShippingRate([
      rate({}),
      rate({
        id: 'local',
        serviceCode: 'starken_flat_xs_local',
        amountClp: 1990,
        zonePriority: 1,
        zoneCommune: 'Las Condes',
      }),
    ], 'Metropolitana de Santiago', 'Las Condes')

    expect(selected).toMatchObject({
      id: 'local',
      amountClp: 1990,
      matchSpecificity: 2,
    })
  })

  it('uses the regional rate outside the warehouse commune', () => {
    const selected = selectBestShippingRate([
      rate({}),
      rate({
        id: 'local',
        serviceCode: 'starken_flat_xs_local',
        amountClp: 1990,
        zonePriority: 1,
        zoneCommune: 'Las Condes',
      }),
    ], 'Metropolitana de Santiago', 'Providencia')

    expect(selected).toMatchObject({
      id: 'regional',
      amountClp: 3490,
      matchSpecificity: 1,
    })
  })

  it('matches accents and rejects a rate from another region', () => {
    const selected = selectBestShippingRate([
      rate({
        id: 'biobio',
        originCode: 'los_angeles',
        zoneRegion: 'Biobío',
      }),
      rate({
        id: 'ohiggins',
        zoneRegion: "Libertador General Bernardo O'Higgins",
      }),
    ], 'Biobio', 'Los Angeles')

    expect(selected).toMatchObject({
      id: 'biobio',
      originCode: 'los_angeles',
      matchSpecificity: 1,
    })
  })
})
