import { describe, expect, it } from 'vitest'
import { PRODUCT_ATTRIBUTES, PRODUCT_TYPES } from '@/lib/constants'
import type { ProductType } from '@/lib/types'

describe('complete equipment category', () => {
  it('is available without structured attributes', () => {
    const type: ProductType = 'equipos_completos'
    expect(PRODUCT_TYPES[type]).toBe('Equipos completos')
    expect(PRODUCT_ATTRIBUTES[type]).toEqual([])
  })
})
