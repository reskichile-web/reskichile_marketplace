import { describe, expect, it } from 'vitest'
import { getPriceDrop } from '@/lib/price-drop'

describe('price drops', () => {
  it('calculates the rounded reduction percentage', () => {
    expect(getPriceDrop(750_000, 900_000)).toEqual({
      previousPrice: 900_000,
      currentPrice: 750_000,
      percent: 17,
    })
  })

  it('ignores missing, unchanged or increased prices', () => {
    expect(getPriceDrop(750_000, null)).toBeNull()
    expect(getPriceDrop(750_000, 750_000)).toBeNull()
    expect(getPriceDrop(900_000, 750_000)).toBeNull()
  })
})
