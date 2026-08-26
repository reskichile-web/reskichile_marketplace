import { NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-security'
import { getAdminProductsPage } from '@/lib/admin-view-data'
import { parseAdminPageParams, sanitizeAdminSearch } from '@/lib/admin-pagination'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requireAdmin()
    const searchParams = new URL(request.url).searchParams
    const { offset, limit } = parseAdminPageParams(searchParams)
    const data = await getAdminProductsPage({
      offset,
      limit,
      status: sanitizeAdminSearch(searchParams.get('status'), 40) || 'all',
      brand: sanitizeAdminSearch(searchParams.get('brand')),
      productType: sanitizeAdminSearch(searchParams.get('type'), 40),
      search: sanitizeAdminSearch(searchParams.get('search')),
    })
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store, private' },
    })
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json(
      { error: known.message, code: known.code },
      { status: known.status, headers: { 'Cache-Control': 'no-store, private' } },
    )
  }
}
