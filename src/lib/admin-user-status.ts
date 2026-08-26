export interface AdminUserAccessState {
  keep: boolean | null
  must_change_password: boolean
}

export type AdminUserAccessStatus = 'active' | 'pending_access' | 'inactive'

/**
 * `keep` is a tri-state legacy flag. Accounts created through the normal
 * signup flow have `keep = null`, so only an explicit `false` means inactive.
 */
export function getAdminUserAccessStatus(user: AdminUserAccessState): AdminUserAccessStatus {
  if (user.keep === false) return 'inactive'
  if (user.must_change_password) return 'pending_access'
  return 'active'
}

export function getAdminUserAccessStats(users: readonly AdminUserAccessState[]) {
  const stats = {
    total: users.length,
    active: 0,
    pendingAccess: 0,
    inactive: 0,
  }

  for (const user of users) {
    const status = getAdminUserAccessStatus(user)
    if (status === 'active') stats.active += 1
    else if (status === 'pending_access') stats.pendingAccess += 1
    else stats.inactive += 1
  }

  return stats
}
