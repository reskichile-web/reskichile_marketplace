export type AdminTimeSort = '' | 'desc' | 'asc'
export type AdminViewSort = '' | 'desc' | 'asc'
export type AdminDatabaseProductSort = AdminTimeSort | 'views_desc' | 'views_asc'

export function parseAdminTimeSort(value: string | null | undefined): AdminTimeSort {
  return value === 'desc' || value === 'asc' ? value : ''
}

export function nextAdminTimeSort(current: AdminTimeSort): AdminTimeSort {
  if (current === '') return 'desc'
  if (current === 'desc') return 'asc'
  return ''
}

export function parseAdminViewSort(value: string | null | undefined): AdminViewSort {
  return value === 'desc' || value === 'asc' ? value : ''
}

export function nextAdminViewSort(current: AdminViewSort): AdminViewSort {
  if (current === '') return 'desc'
  if (current === 'desc') return 'asc'
  return ''
}

export function toAdminDatabaseProductSort(
  timeSort: AdminTimeSort,
  viewSort: AdminViewSort,
): AdminDatabaseProductSort {
  if (viewSort) return `views_${viewSort}`
  return timeSort
}
