export const ADMIN_PAGE_SIZE = 30
export const ADMIN_MAX_PAGE_SIZE = 100

export interface AdminPageParams {
  offset: number
  limit: number
}

export interface AdminPageMeta {
  totalCount: number
  nextOffset: number
  hasMore: boolean
}

export function parseAdminPageParams(
  searchParams: URLSearchParams,
  options: { defaultLimit?: number; maxLimit?: number } = {},
): AdminPageParams {
  const defaultLimit = options.defaultLimit ?? ADMIN_PAGE_SIZE
  const maxLimit = options.maxLimit ?? ADMIN_MAX_PAGE_SIZE
  const rawOffset = Number(searchParams.get('offset') || 0)
  const rawLimit = Number(searchParams.get('limit') || defaultLimit)

  return {
    offset: Number.isFinite(rawOffset) && rawOffset >= 0
      ? Math.min(Math.floor(rawOffset), 100_000)
      : 0,
    limit: Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), maxLimit)
      : defaultLimit,
  }
}

export function adminPageMeta(
  totalCount: number,
  offset: number,
  returnedCount: number,
): AdminPageMeta {
  const nextOffset = offset + returnedCount
  return {
    totalCount,
    nextOffset,
    hasMore: returnedCount > 0 && nextOffset < totalCount,
  }
}

export function sanitizeAdminSearch(value: string | null, maximumLength = 80): string {
  return (value || '')
    .replace(/[,()%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength)
}
