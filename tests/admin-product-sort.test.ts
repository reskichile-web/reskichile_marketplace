import { describe, expect, it } from 'vitest'
import { nextAdminTimeSort, parseAdminTimeSort } from '@/lib/admin-product-sort'

describe('admin product time sorting', () => {
  it('cycles from descending to ascending and then removes the explicit sort', () => {
    expect(nextAdminTimeSort('')).toBe('desc')
    expect(nextAdminTimeSort('desc')).toBe('asc')
    expect(nextAdminTimeSort('asc')).toBe('')
  })

  it('accepts only supported API values', () => {
    expect(parseAdminTimeSort('desc')).toBe('desc')
    expect(parseAdminTimeSort('asc')).toBe('asc')
    expect(parseAdminTimeSort('newest')).toBe('')
    expect(parseAdminTimeSort(null)).toBe('')
  })
})
