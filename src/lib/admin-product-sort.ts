export type AdminTimeSort = '' | 'desc' | 'asc'

export function parseAdminTimeSort(value: string | null | undefined): AdminTimeSort {
  return value === 'desc' || value === 'asc' ? value : ''
}

export function nextAdminTimeSort(current: AdminTimeSort): AdminTimeSort {
  if (current === '') return 'desc'
  if (current === 'desc') return 'asc'
  return ''
}

