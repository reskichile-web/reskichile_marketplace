import { describe, expect, it } from 'vitest'
import { getAdminUserAccessStats, getAdminUserAccessStatus } from '@/lib/admin-user-status'

describe('admin user access status', () => {
  it('counts normal signup accounts with keep=null as active', () => {
    expect(getAdminUserAccessStatus({ keep: null, must_change_password: false })).toBe('active')
  })

  it('keeps the three statuses mutually exclusive', () => {
    const users = [
      { keep: null, must_change_password: false },
      { keep: true, must_change_password: false },
      { keep: true, must_change_password: true },
      { keep: false, must_change_password: true },
    ]

    const stats = getAdminUserAccessStats(users)

    expect(stats).toEqual({
      total: 4,
      active: 2,
      pendingAccess: 1,
      inactive: 1,
    })
    expect(stats.active + stats.pendingAccess + stats.inactive).toBe(stats.total)
  })
})
