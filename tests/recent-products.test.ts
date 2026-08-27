import { describe, expect, it } from 'vitest'
import { getRecentlyPublishedProductIds } from '@/lib/recent-products'

const NOW = Date.UTC(2026, 7, 27, 12)
const DAY = 24 * 60 * 60 * 1000

function product(id: string, daysAgo: number) {
  return { id, created_at: new Date(NOW - daysAgo * DAY).toISOString() }
}

describe('recently published products', () => {
  it('keeps at least the five newest products highlighted', () => {
    const ids = getRecentlyPublishedProductIds([
      product('one', 0),
      product('two', 1),
      product('three', 2),
      product('four', 8),
      product('five', 10),
      product('six', 12),
    ])

    expect([...ids]).toEqual(['one', 'two', 'three', 'four', 'five'])
  })

  it('never highlights more than five products, even during a busy day', () => {
    const ids = getRecentlyPublishedProductIds([
      product('one', 0),
      product('two', 0.05),
      product('three', 0.1),
      product('four', 0.15),
      product('five', 0.2),
      product('six', 0.25),
      product('seven', 0.3),
    ])

    expect([...ids]).toEqual(['one', 'two', 'three', 'four', 'five'])
  })
})
