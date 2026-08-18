export type ShippingOriginCode = 'los_angeles' | 'las_condes'

export interface TableShippingRateCandidate {
  id: string
  originCode: ShippingOriginCode
  serviceCode: string
  amountClp: number
  minDeliveryDays: number | null
  maxDeliveryDays: number | null
  zonePriority: number
  zoneRegion: string | null
  zoneCommune: string | null
}

export interface SelectedShippingRate extends TableShippingRateCandidate {
  matchSpecificity: 0 | 1 | 2
}

function normalizedPlace(value: string | null): string | null {
  if (value == null) return null
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es-CL')
}

function matchSpecificity(
  rate: TableShippingRateCandidate,
  destinationRegion: string,
  destinationCommune: string,
): 0 | 1 | 2 | null {
  const rateRegion = normalizedPlace(rate.zoneRegion)
  const rateCommune = normalizedPlace(rate.zoneCommune)
  const region = normalizedPlace(destinationRegion)
  const commune = normalizedPlace(destinationCommune)

  if (rateCommune != null) {
    return rateCommune === commune && (rateRegion == null || rateRegion === region)
      ? 2
      : null
  }
  if (rateRegion != null) return rateRegion === region ? 1 : null
  return 0
}

function deliveryDays(value: number | null): number {
  return value == null ? Number.MAX_SAFE_INTEGER : value
}

function compareWithinOrigin(
  left: SelectedShippingRate,
  right: SelectedShippingRate,
): number {
  return (
    right.matchSpecificity - left.matchSpecificity ||
    left.zonePriority - right.zonePriority ||
    left.amountClp - right.amountClp ||
    deliveryDays(left.maxDeliveryDays) - deliveryDays(right.maxDeliveryDays) ||
    left.serviceCode.localeCompare(right.serviceCode)
  )
}

/**
 * Selects a real, configured shipping rate without trusting the browser.
 * The most specific zone wins within each warehouse. Warehouses are then
 * compared by total rate, promised delivery time and a stable final tie-break.
 */
export function selectBestShippingRate(
  rates: TableShippingRateCandidate[],
  destinationRegion: string,
  destinationCommune: string,
): SelectedShippingRate | null {
  const matched = rates.flatMap(rate => {
    const specificity = matchSpecificity(rate, destinationRegion, destinationCommune)
    return specificity == null ? [] : [{ ...rate, matchSpecificity: specificity }]
  })

  const bestByOrigin = new Map<ShippingOriginCode, SelectedShippingRate>()
  for (const candidate of matched) {
    const current = bestByOrigin.get(candidate.originCode)
    if (!current || compareWithinOrigin(candidate, current) < 0) {
      bestByOrigin.set(candidate.originCode, candidate)
    }
  }

  return Array.from(bestByOrigin.values()).sort((left, right) => (
    left.amountClp - right.amountClp ||
    deliveryDays(left.maxDeliveryDays) - deliveryDays(right.maxDeliveryDays) ||
    deliveryDays(left.minDeliveryDays) - deliveryDays(right.minDeliveryDays) ||
    left.originCode.localeCompare(right.originCode)
  ))[0] || null
}
