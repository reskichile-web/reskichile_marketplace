import { NextResponse } from 'next/server'
import { adminErrorResponse } from '@/lib/admin-security'
import { getAdminInstagramStories } from '@/lib/admin-view-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams
    const data = await getAdminInstagramStories({
      historyDays: Number(searchParams.get('historyDays') || 0),
      includeUncaptured: searchParams.get('includeUncaptured') === 'true',
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
