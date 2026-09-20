import { describe, expect, it } from 'vitest'
import {
  isRecordedSaleFromYear,
  recordedFinalPrice,
  recordedSaleDate,
  recordedSalesSummary,
  type RecordedSale,
} from '@/lib/sales-reference'

function sale(overrides: Partial<RecordedSale> = {}): RecordedSale {
  return {
    price: 200_000,
    sale_price: 150_000,
    sold_at: '2026-08-15T14:00:00.000Z',
    updated_at: '2026-08-15T14:00:00.000Z',
    ...overrides,
  }
}

describe('public 2026 sales reference', () => {
  it('uses the explicit sale date and falls back to the legacy update date', () => {
    expect(recordedSaleDate(sale()).toISOString()).toBe('2026-08-15T14:00:00.000Z')
    expect(recordedSaleDate(sale({
      sold_at: null,
      updated_at: '2026-04-10T12:00:00.000Z',
    })).toISOString()).toBe('2026-04-10T12:00:00.000Z')
  })

  it('includes only records attributed to 2026', () => {
    expect(isRecordedSaleFromYear(sale())).toBe(true)
    expect(isRecordedSaleFromYear(sale({ sold_at: '2025-12-31T23:59:59.000Z' }))).toBe(false)
    expect(isRecordedSaleFromYear(sale({ sold_at: '2027-01-01T01:30:00.000Z' }))).toBe(true)
  })

  it('uses the original listing price when no final price was reported', () => {
    expect(recordedFinalPrice(sale({ sale_price: null, price: 275_000 }))).toBe(275_000)
  })

  it('summarizes final prices and reductions with medians', () => {
    expect(recordedSalesSummary([
      sale({ price: 200_000, sale_price: 150_000 }),
      sale({ price: 300_000, sale_price: 240_000 }),
      sale({ price: 400_000, sale_price: 400_000 }),
      sale({ price: 180_000, sale_price: null }),
    ])).toEqual({
      count: 4,
      medianSalePrice: 210_000,
      medianDiscountPercent: 20,
    })
  })
})
