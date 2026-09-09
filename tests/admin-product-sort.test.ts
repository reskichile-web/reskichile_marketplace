import { describe, expect, it } from 'vitest'
import {
  nextAdminTimeSort,
  nextAdminViewSort,
  parseAdminTimeSort,
  parseAdminViewSort,
  toAdminDatabaseProductSort,
} from '@/lib/admin-product-sort'

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

  it('cycles and validates product-view sorting independently', () => {
    expect(nextAdminViewSort('')).toBe('desc')
    expect(nextAdminViewSort('desc')).toBe('asc')
    expect(nextAdminViewSort('asc')).toBe('')
    expect(parseAdminViewSort('desc')).toBe('desc')
    expect(parseAdminViewSort('asc')).toBe('asc')
    expect(parseAdminViewSort('popular')).toBe('')
  })

  it('gives product-view sorting precedence in the database sort value', () => {
    expect(toAdminDatabaseProductSort('asc', 'desc')).toBe('views_desc')
    expect(toAdminDatabaseProductSort('desc', '')).toBe('desc')
    expect(toAdminDatabaseProductSort('', '')).toBe('')
  })
})
