export interface PriceDrop {
  previousPrice: number
  currentPrice: number
  percent: number
}

export function getPriceDrop(
  currentPrice: number,
  previousPrice: number | null | undefined,
): PriceDrop | null {
  if (
    !Number.isFinite(currentPrice)
    || currentPrice <= 0
    || previousPrice == null
    || !Number.isFinite(previousPrice)
    || previousPrice <= currentPrice
  ) {
    return null
  }

  return {
    previousPrice,
    currentPrice,
    percent: Math.round((1 - currentPrice / previousPrice) * 100),
  }
}

