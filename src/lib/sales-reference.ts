export const SALES_REFERENCE_YEAR = 2026

export interface RecordedSale {
  price: number
  sale_price: number | null
  sold_at: string | null
  updated_at: string
}

export function recordedSaleDate(sale: RecordedSale): Date {
  return new Date(sale.sold_at || sale.updated_at)
}

export function isRecordedSaleFromYear(
  sale: RecordedSale,
  year = SALES_REFERENCE_YEAR,
): boolean {
  const date = recordedSaleDate(sale)
  if (!Number.isFinite(date.getTime())) return false
  const chileYear = Number(new Intl.DateTimeFormat('en', {
    year: 'numeric',
    timeZone: 'America/Santiago',
  }).format(date))
  return chileYear === year
}

export function recordedFinalPrice(sale: RecordedSale): number {
  return sale.sale_price ?? sale.price
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle]
}

export function recordedSalesSummary(sales: RecordedSale[]): {
  count: number
  medianSalePrice: number
  medianDiscountPercent: number
} {
  const discounts = sales.flatMap(sale => {
    const finalPrice = sale.sale_price
    return finalPrice != null && sale.price > 0 && finalPrice <= sale.price
      ? [Math.round(((sale.price - finalPrice) / sale.price) * 100)]
      : []
  })

  return {
    count: sales.length,
    medianSalePrice: median(sales.map(recordedFinalPrice)),
    medianDiscountPercent: median(discounts),
  }
}
