import { NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-security'
import type {
  InstagramAdminCalendarResponse,
  InstagramAdminCapture,
} from '@/lib/instagram/admin-contracts'
import { getInstagramPublishingConfig } from '@/lib/instagram/publishing-config'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
  attempts: number
  last_error: string | null
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
    attempts: row.attempts,
    lastError: row.last_error,
  }
}

export async function GET() {
  try {
    await requireAdmin()
    const service = createServiceRoleClient()
    const [productsResult, capturesResult] = await Promise.all([
      service
        .from('products')
        .select('id, brand, model, slug, product_type, price, product_images (url, order)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false }),
      service
        .from('instagram_story_captures')
        .select('id, product_id, status, jpeg_public_url, approved_at, generated_at, updated_at, scheduled_local_date, scheduled_slot, scheduled_for, schedule_source, container_id, media_id, published_at, attempts, last_error')
        .order('approved_at', { ascending: true }),
    ])
    if (productsResult.error || capturesResult.error) {
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
