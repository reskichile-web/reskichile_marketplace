import type { StarkenPackage } from './starken'

export type StarkenTariffTier = 'xs' | 's' | 'm' | 'l'

export interface StarkenPackagedLine {
  packaged_length_cm: number | null
  packaged_width_cm: number | null
  packaged_height_cm: number | null
  packaged_weight_kg: number | null
  quantity?: number
}

const VOLUMETRIC_DIVISOR_CM3_PER_KG = 4000

/**
 * Consolidates a cart into one volume-equivalent parcel. This keeps the total
 * physical weight and volume while avoiding the old one-box-per-unit charge.
 */
export function combineStarkenParcel(
  lines: StarkenPackagedLine[],
): StarkenPackage | null {
  const quantity = (line: StarkenPackagedLine): number => Number(line.quantity ?? 1)
  if (lines.length === 0 || lines.some(line => (
    line.packaged_length_cm == null || line.packaged_width_cm == null ||
    line.packaged_height_cm == null || line.packaged_weight_kg == null ||
    !Number.isSafeInteger(quantity(line)) || quantity(line) < 1
  ))) return null

  const unitCount = lines.reduce((sum, line) => sum + quantity(line), 0)
  const weightKg = lines.reduce(
    (sum, line) => sum + Number(line.packaged_weight_kg) * quantity(line),
    0,
  )
  const volumeCm3 = lines.reduce((sum, line) => (
    sum + Number(line.packaged_length_cm) * Number(line.packaged_width_cm) *
      Number(line.packaged_height_cm) * quantity(line)
  ), 0)
  const dimensions = lines.flatMap(line => [
    Number(line.packaged_length_cm),
    Number(line.packaged_width_cm),
    Number(line.packaged_height_cm),
  ])
  const parcel = unitCount === 1
    ? {
        lengthCm: Number(lines[0].packaged_length_cm),
        widthCm: Number(lines[0].packaged_width_cm),
        heightCm: Number(lines[0].packaged_height_cm),
        weightKg,
      }
    : (() => {
        // Starken's official plugin represents a multi-product cart as one
        // volume-equivalent parcel while preserving the longest dimension.
        const widthCm = Math.max(...dimensions)
        const heightCm = Math.sqrt((volumeCm3 / widthCm) * (2 / 3))
        return {
          widthCm,
          heightCm,
          lengthCm: volumeCm3 / widthCm / heightCm,
          weightKg,
        }
      })()

  if (Object.values(parcel).some(value => !Number.isFinite(value) || value <= 0)) {
    return null
  }
  return parcel
}

/** Starken charges the greater of physical and volumetric weight. */
export function starkenBillableWeightKg(parcel: StarkenPackage): number {
  const volumetricWeightKg = (
    parcel.lengthCm * parcel.widthCm * parcel.heightCm
  ) / VOLUMETRIC_DIVISOR_CM3_PER_KG
  return Math.max(parcel.weightKg, volumetricWeightKg)
}

/** Public Tarifa Simple tiers. Parcels above 10 kg require another quote. */
export function starkenTariffTier(
  parcel: StarkenPackage,
): StarkenTariffTier | null {
  const billableWeightKg = starkenBillableWeightKg(parcel)
  if (!Number.isFinite(billableWeightKg) || billableWeightKg <= 0) return null
  if (billableWeightKg <= 0.85) return 'xs'
  if (billableWeightKg <= 3) return 's'
  if (billableWeightKg <= 6) return 'm'
  if (billableWeightKg <= 10) return 'l'
  return null
}
