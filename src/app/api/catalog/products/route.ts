import { NextRequest, NextResponse } from 'next/server'
import { parseCatalogFilters } from '@/lib/catalog'
import { fetchCatalogProductPage } from '@/lib/catalog-server'
import { createPublicServerClient } from '@/lib/supabase/server'

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
}

export async function GET(request: NextRequest) {
  const rawOffset = Number(request.nextUrl.searchParams.get('offset') || '0')
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0
    ? Math.min(Math.floor(rawOffset), 10_000)
    : 0

  try {
    const filters = parseCatalogFilters(request.nextUrl.searchParams)
    const page = await fetchCatalogProductPage(createPublicServerClient(), filters, offset)

    return NextResponse.json(page, { headers: CACHE_HEADERS })
  } catch {
    console.error('catalog_incremental_load_failed')
    return NextResponse.json(
      { error: 'No pudimos cargar más productos.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
