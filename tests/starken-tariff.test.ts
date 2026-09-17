import { describe, expect, it } from 'vitest'
import {
  combineStarkenParcel,
  starkenBillableWeightKg,
  starkenTariffTier,
} from '@/lib/shipping/starken-tariff'

const skiRackPackage = {
  packaged_length_cm: 15,
  packaged_width_cm: 10,
  packaged_height_cm: 3,
  packaged_weight_kg: 0.140,
}

describe('Starken consolidated tariff', () => {
  it('keeps one Ski Rack in XS', () => {
    const parcel = combineStarkenParcel([skiRackPackage])

    expect(parcel).toEqual({
      lengthCm: 15,
      widthCm: 10,
      heightCm: 3,
      weightKg: 0.140,
    })
    expect(starkenTariffTier(parcel!)).toBe('xs')
  })

  it('charges five Ski Racks as one XS parcel instead of five shipments', () => {
    const parcel = combineStarkenParcel([{ ...skiRackPackage, quantity: 5 }])

    expect(parcel?.weightKg).toBeCloseTo(0.7)
    expect(parcel!.lengthCm * parcel!.widthCm * parcel!.heightCm).toBeCloseTo(2250)
    expect(starkenBillableWeightKg(parcel!)).toBeCloseTo(0.7)
    expect(starkenTariffTier(parcel!)).toBe('xs')
  })

  it('moves seven Ski Racks to S using their consolidated weight', () => {
    const parcel = combineStarkenParcel([{ ...skiRackPackage, quantity: 7 }])

    expect(parcel?.weightKg).toBeCloseTo(0.98)
    expect(starkenTariffTier(parcel!)).toBe('s')
  })

  it('uses volumetric weight when it exceeds physical weight', () => {
    const parcel = {
      lengthCm: 40,
      widthCm: 20,
      heightCm: 30,
      weightKg: 1,
    }

    expect(starkenBillableWeightKg(parcel)).toBe(6)
    expect(starkenTariffTier(parcel)).toBe('m')
  })

  it('requires a separate quote above Tarifa Simple limits', () => {
    expect(starkenTariffTier({
      lengthCm: 60,
      widthCm: 30,
      heightCm: 30,
      weightKg: 12,
    })).toBeNull()
  })
})
