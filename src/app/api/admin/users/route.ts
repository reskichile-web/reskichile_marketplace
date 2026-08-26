import { NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-security'
import { adminPageMeta, parseAdminPageParams, sanitizeAdminSearch } from '@/lib/admin-pagination'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getAdminUserAccessStats, getAdminUserAccessStatus } from '@/lib/admin-user-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ActivityRow {
  user_id: string
  last_activity: string
}

interface UserCandidate {
  id: string
  email: string
  name: string | null
  phone: string | null
  keep: boolean | null
  must_change_password: boolean
  created_at: string
}

const PINNED_LAST = new Set(['sebastian.derpsch@gmail.com', 'reskichile@gmail.com'])

export async function GET(request: Request) {
  try {
    const requestUser = await requireAdmin()
    const service = createServiceRoleClient()
    const searchParams = new URL(request.url).searchParams
    const { offset, limit } = parseAdminPageParams(searchParams)
    const filter = sanitizeAdminSearch(searchParams.get('status'), 30)
    const search = sanitizeAdminSearch(searchParams.get('search'))

    // Like the public catalog, use one lightweight metadata set to preserve
    // global filtering and activity ordering, then fetch full rows only for
    // the visible page.
    const [candidateResult, activityResult] = await Promise.all([
      service
        .from('users')
        .select('id, email, name, phone, keep, must_change_password, created_at'),
      service.rpc('admin_user_last_activity'),
    ])
    if (candidateResult.error || activityResult.error) {
      throw new Error('admin users query failed')
    }

    const activityMap = new Map<string, string>()
    for (const row of (activityResult.data as ActivityRow[] | null) || []) {
      activityMap.set(row.user_id, row.last_activity)
    }

    // Auth confirmation/sign-in data is one compact GoTrue request for the
    // common case (<1000 users). It is not expanded into the JSON response;
    // only the visible page is returned.
    const confirmedMap = new Map<string, string | null>()
    const lastSignInMap = new Map<string, string | null>()
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) break
      for (const authUser of data.users) {
        confirmedMap.set(authUser.id, authUser.email_confirmed_at ?? null)
        lastSignInMap.set(authUser.id, authUser.last_sign_in_at ?? null)
      }
      if (data.users.length < 1000) break
    }

    const normalizedSearch = search.toLocaleLowerCase('es')
    const candidates = ((candidateResult.data || []) as UserCandidate[])
      .filter(candidate => {
        if (filter && filter !== 'all' && getAdminUserAccessStatus(candidate) !== filter) return false
        if (!normalizedSearch) return true
        return [candidate.email, candidate.name, candidate.phone]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(normalizedSearch)
      })
      .sort((left, right) => {
        const leftPinned = PINNED_LAST.has(left.email.toLowerCase())
        const rightPinned = PINNED_LAST.has(right.email.toLowerCase())
        if (leftPinned !== rightPinned) return leftPinned ? 1 : -1
        const leftActivity = activityMap.get(left.id)
        const rightActivity = activityMap.get(right.id)
        const leftTimestamp = Math.max(
          leftActivity ? Date.parse(leftActivity) : 0,
          lastSignInMap.get(left.id) ? Date.parse(lastSignInMap.get(left.id)!) : 0,
        )
        const rightTimestamp = Math.max(
          rightActivity ? Date.parse(rightActivity) : 0,
          lastSignInMap.get(right.id) ? Date.parse(lastSignInMap.get(right.id)!) : 0,
        )
        if (leftTimestamp !== rightTimestamp) return rightTimestamp - leftTimestamp
        return Date.parse(right.created_at) - Date.parse(left.created_at)
      })

    const visibleIds = candidates.slice(offset, offset + limit).map(candidate => candidate.id)
    const usersResult = visibleIds.length > 0
      ? await service
        .from('users')
        .select('id, email, name, phone, instagram, is_admin, must_change_password, keep, created_at, avatar_url')
        .in('id', visibleIds)
      : { data: [], error: null }
    if (usersResult.error) throw new Error('admin user page query failed')
    const rowById = new Map((usersResult.data || []).map(row => [row.id, row]))
    const rows = visibleIds
      .map(id => rowById.get(id))
      .filter((row): row is NonNullable<typeof row> => row != null)
    const userIds = rows.map(row => row.id)
    const productCounts: Record<string, number> = {}
    if (userIds.length > 0) {
      const { data: products, error } = await service
        .from('products')
        .select('seller_id')
        .in('seller_id', userIds)
      if (error) throw new Error('admin user products query failed')
      for (const product of products || []) {
        productCounts[product.seller_id] = (productCounts[product.seller_id] || 0) + 1
      }
    }

    const users = rows.map(row => {
      const eventTimestamp = activityMap.get(row.id)
      const signInTimestamp = lastSignInMap.get(row.id)
      const candidates = [eventTimestamp, signInTimestamp].filter(Boolean) as string[]
      return {
        ...row,
        product_count: productCounts[row.id] || 0,
        email_confirmed_at: confirmedMap.get(row.id) ?? null,
        // DNS validation no longer blocks the initial list. Complete Auth
        // information is still loaded when the row is expanded.
        email_deliverable: null,
        last_activity: candidates.length
          ? candidates.reduce((left, right) => Date.parse(left) >= Date.parse(right) ? left : right)
          : null,
      }
    })

    const stats = offset === 0
      ? getAdminUserAccessStats(candidateResult.data || [])
      : null
    return NextResponse.json({
      users,
      stats,
      currentUserId: requestUser.id,
      ...adminPageMeta(candidates.length, offset, users.length),
    }, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json(
      { error: known.message, code: known.code },
      { status: known.status, headers: { 'Cache-Control': 'no-store, private' } },
    )
  }
}
