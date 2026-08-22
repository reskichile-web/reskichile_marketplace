import { NextResponse } from 'next/server'
import {
  adminErrorResponse,
  assertSameOrigin,
  requireAdmin,
} from '@/lib/admin-security'
import {
  captureResultFromDatabaseRow,
  generateAndStoreStoryCapture,
} from '@/lib/instagram/capture'
import type {
  AdminStoryRetryResponse,
  InstagramStoryCaptureStatus,
} from '@/lib/instagram/contracts'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 120

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface RetryClaim {
  capture_id: string
  capture_status: InstagramStoryCaptureStatus
  should_render: boolean
  jpeg_storage_path: string
  jpeg_public_url: string | null
  approved_at: string
  generated_at: string | null
  updated_at: string
  last_error: string | null
}

function retryRpcError(error: { message?: string } | null) {
  const raw = error?.message || ''
  if (raw.includes('PRODUCT_NOT_FOUND')) {
    return { message: 'Producto no encontrado', status: 404, code: 'PRODUCT_NOT_FOUND' }
  }
  if (raw.includes('PRODUCT_NOT_APPROVED')) {
    return { message: 'El producto ya no está aprobado', status: 409, code: 'PRODUCT_NOT_APPROVED' }
  }
  if (raw.includes('CAPTURE_GENERATION_BUSY')) {
    return {
      message: 'Ya se está generando otra Story. Espera a que termine.',
      status: 409,
      code: 'CAPTURE_GENERATION_BUSY',
    }
  }
  return { message: 'No pudimos iniciar el reintento', status: 500, code: 'RETRY_FAILED' }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    await requireAdmin()
    const { id } = await params
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { error: 'Producto inválido', code: 'INVALID_PRODUCT_ID' },
        { status: 422, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const service = createServiceRoleClient()
    const { data: product, error: productError } = await service
      .from('products')
      .select('id, brand, model, slug, status')
      .eq('id', id)
      .maybeSingle()
    if (productError || !product) {
      return NextResponse.json(
        { error: 'Producto no encontrado', code: 'PRODUCT_NOT_FOUND' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const { data: claimData, error: claimError } = await service.rpc(
      'instagram_begin_capture_retry',
      { p_product_id: id },
    )
    const claim = (Array.isArray(claimData) ? claimData[0] : claimData) as RetryClaim | null
    if (claimError || !claim) {
      const known = retryRpcError(claimError)
      return NextResponse.json(
        { error: known.message, code: known.code },
        { status: known.status, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    let story = captureResultFromDatabaseRow({
      id: claim.capture_id,
      status: claim.capture_status,
      jpeg_public_url: claim.jpeg_public_url,
      updated_at: claim.updated_at,
    })
    if (claim.should_render) {
      story = await generateAndStoreStoryCapture({
        captureId: claim.capture_id,
        productId: product.id,
        slug: product.slug || '',
        storagePath: claim.jpeg_storage_path,
      })
    } else if (claim.last_error) {
      story = { ...story, error: claim.last_error }
    }

    if (story.status === 'generating') {
      return NextResponse.json(
        { error: 'La Story todavía se está generando.', code: 'CAPTURE_GENERATION_IN_PROGRESS' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    if (story.status !== 'ready' && story.status !== 'failed') {
      return NextResponse.json(
        { error: 'Esta captura no admite un reintento de render.', code: 'CAPTURE_NOT_RETRYABLE' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const response: AdminStoryRetryResponse = {
      ok: true,
      approved: true,
      product: {
        id: product.id,
        title: [product.brand, product.model].filter(Boolean).join(' '),
        slug: product.slug || product.id,
      },
      story,
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
