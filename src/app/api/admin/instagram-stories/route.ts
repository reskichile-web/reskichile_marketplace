import { NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-security'
import type {
  InstagramAdminCalendarResponse,
  InstagramAdminCapture,
  InstagramAdminPublication,
} from '@/lib/instagram/admin-contracts'
import { getInstagramPublishingConfig } from '@/lib/instagram/publishing-config'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_HISTORY_DAYS = 365

interface ProductRow {
  id: string
  brand: string
  model: string | null
  slug: string | null
  product_type: string
  price: number
  product_images: { url: string; order: number }[] | null
}

interface CaptureRow {
  id: string
  product_id: string
  status: InstagramAdminCapture['status']
  jpeg_public_url: string | null
  approved_at: string
  generated_at: string | null
  updated_at: string
  scheduled_local_date: string | null
  scheduled_slot: number | null
  scheduled_for: string | null
  schedule_source: InstagramAdminCapture['scheduleSource']
  container_id: string | null
  media_id: string | null
  published_at: string | null
  publication_count: number
  last_published_at: string | null
  attempts: number
  last_error: string | null
}

interface PublicationRow {
  id: string
  capture_id: string
  product_id: string
  container_id: string
  media_id: string | null
  published_at: string
  recovered: boolean
  scheduled_local_date: string
  scheduled_slot: number
  scheduled_for: string
  schedule_source: InstagramAdminPublication['scheduleSource']
  products: {
    brand: string
    model: string | null
    slug: string | null
    product_type: string
    product_images: { url: string; order: number }[] | null
  }
}

function captureFromRow(row: CaptureRow): InstagramAdminCapture {
  return {
    id: row.id,
    productId: row.product_id,
    status: row.status,
    jpegPublicUrl: row.jpeg_public_url,
    approvedAt: row.approved_at,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
    scheduledLocalDate: row.scheduled_local_date,
    scheduledSlot: row.scheduled_slot,
    scheduledFor: row.scheduled_for,
    scheduleSource: row.schedule_source,
    containerId: row.container_id,
    mediaId: row.media_id,
    publishedAt: row.published_at,
    publicationCount: row.publication_count,
    lastPublishedAt: row.last_published_at,
    attempts: row.attempts,
    lastError: row.last_error,
  }
}

function chileToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function addLocalDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function publicationFromRow(row: PublicationRow): InstagramAdminPublication {
  const images = [...(row.products.product_images ?? [])]
    .sort((left, right) => left.order - right.order)
  return {
    id: row.id,
    captureId: row.capture_id,
    productId: row.product_id,
    title: [row.products.brand, row.products.model].filter(Boolean).join(' '),
    slug: row.products.slug || row.product_id,
    productType: row.products.product_type,
    imageUrl: images[0]?.url || null,
    containerId: row.container_id,
    mediaId: row.media_id,
    publishedAt: row.published_at,
    recovered: row.recovered,
    scheduledLocalDate: row.scheduled_local_date,
    scheduledSlot: row.scheduled_slot,
    scheduledFor: row.scheduled_for,
    scheduleSource: row.schedule_source,
  }
}

export async function GET(request: Request) {
  try {
    await requireAdmin()
    const service = createServiceRoleClient()
    const requestedHistoryDays = Number(new URL(request.url).searchParams.get('historyDays') || 0)
    const historyDays = Number.isInteger(requestedHistoryDays)
      ? Math.min(MAX_HISTORY_DAYS, Math.max(0, requestedHistoryDays))
      : 0
    const historyStart = addLocalDays(chileToday(), -historyDays)
    const [productsResult, capturesResult, publicationsResult] = await Promise.all([
      service
        .from('products')
        .select('id, brand, model, slug, product_type, price, product_images (url, order)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false }),
      service
        .from('instagram_story_captures')
        .select('id, product_id, status, jpeg_public_url, approved_at, generated_at, updated_at, scheduled_local_date, scheduled_slot, scheduled_for, schedule_source, container_id, media_id, published_at, publication_count, last_published_at, attempts, last_error')
        .order('approved_at', { ascending: true }),
      service
        .from('instagram_story_publications')
        .select('id, capture_id, product_id, container_id, media_id, published_at, recovered, scheduled_local_date, scheduled_slot, scheduled_for, schedule_source, products!inner(brand, model, slug, product_type, product_images(url, order))')
        .not('scheduled_local_date', 'is', null)
        .gte('scheduled_local_date', historyStart)
        .order('scheduled_local_date', { ascending: false })
        .order('scheduled_slot', { ascending: false }),
    ])
    if (productsResult.error || capturesResult.error || publicationsResult.error) {
      throw new Error('No pudimos leer el calendario de Instagram')
    }

    const captures = new Map(
      ((capturesResult.data ?? []) as CaptureRow[]).map((row) => [row.product_id, captureFromRow(row)]),
    )
    const products = ((productsResult.data ?? []) as unknown as ProductRow[]).map((product) => {
      const image = [...(product.product_images ?? [])].sort((left, right) => left.order - right.order)[0]
      return {
        id: product.id,
        title: [product.brand, product.model].filter(Boolean).join(' '),
        slug: product.slug || product.id,
        productType: product.product_type,
        price: product.price,
        imageUrl: image?.url || null,
        capture: captures.get(product.id) || null,
      }
    })
    const response: InstagramAdminCalendarResponse = {
      ok: true,
      publishingEnabled: getInstagramPublishingConfig().enabled,
      products,
      publications: ((publicationsResult.data ?? []) as unknown as PublicationRow[])
        .map(publicationFromRow),
    }
    return NextResponse.json(response, {
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
