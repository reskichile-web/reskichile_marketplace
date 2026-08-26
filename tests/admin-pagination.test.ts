import { describe, expect, it } from 'vitest'
import {
  adminPageMeta,
  parseAdminPageParams,
  sanitizeAdminSearch,
} from '@/lib/admin-pagination'

describe('admin pagination', () => {
  it('uses a small first page and clamps untrusted values', () => {
    expect(parseAdminPageParams(new URLSearchParams())).toEqual({ offset: 0, limit: 30 })
    expect(parseAdminPageParams(new URLSearchParams('offset=-3&limit=900'))).toEqual({
      offset: 0,
      limit: 100,
    })
  })

  it('reports the next incremental page', () => {
    expect(adminPageMeta(75, 30, 30)).toEqual({
      totalCount: 75,
      nextOffset: 60,
      hasMore: true,
    })
    expect(adminPageMeta(45, 30, 15).hasMore).toBe(false)
  })

  it('removes PostgREST control punctuation from searches', () => {
    expect(sanitizeAdminSearch('  marca,(modelo)%  ')).toBe('marca modelo')
  })
})
