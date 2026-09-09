import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getInstagramCronSecret, getInstagramPublishingConfig } from '@/lib/instagram/publishing-config'
import { runCatalogWorker } from '@/lib/instagram/catalog-worker'
import { isInstagramCatalogEnabled } from '@/lib/instagram/catalog-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store, private' }
  try {
    const actual = Buffer.from(request.headers.get('authorization') || '')
    const expected = Buffer.from(`Bearer ${getInstagramCronSecret()}`)
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers })
    // Catalog activation is separate from existing individual Stories. Preview
    // deployments must never consume the production queue or send real Stories.
    if (!isInstagramCatalogEnabled()) {
      return NextResponse.json({ state: 'disabled' }, { headers })
    }
    return NextResponse.json(await runCatalogWorker(getInstagramPublishingConfig()), { headers })
  } catch {
    return NextResponse.json({ error: 'No se pudo procesar la tanda del catálogo' }, { status: 500, headers })
  }
}
