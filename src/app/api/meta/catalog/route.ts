import { buildMetaCatalogFeed } from '@/lib/meta-catalog'
import { createPublicServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FAILURE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'text/plain; charset=utf-8',
  'Retry-After': '300',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
}

export async function GET() {
  try {
    const feed = await buildMetaCatalogFeed(createPublicServerClient())

    if (feed.excludedProductIds.length > 0) {
      console.warn('meta_catalog_products_excluded', {
        count: feed.excludedProductIds.length,
        productIds: feed.excludedProductIds,
      })
    }

    return new Response(feed.csv, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Disposition': 'inline; filename="reskichile-meta-catalog.csv"',
        'Content-Type': 'text/csv; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'X-Reski-Catalog-Items': String(feed.includedCount),
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  } catch {
    console.error('meta_catalog_feed_failed')
    return new Response('Meta catalog feed temporarily unavailable.\n', {
      status: 503,
      headers: FAILURE_HEADERS,
    })
  }
}
