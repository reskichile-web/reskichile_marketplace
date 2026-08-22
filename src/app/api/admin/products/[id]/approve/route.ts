import { NextResponse } from 'next/server'
import {
  adminErrorResponse,
  assertSameOrigin,
  requireAdmin,
} from '@/lib/admin-security'
import { sendEmail } from '@/lib/email/send'
import { buildApprovedEmail } from '@/lib/email/templates'
import {
  captureResultFromDatabaseRow,
  generateAndStoreStoryCapture,
} from '@/lib/instagram/capture'
import type {
  AdminApprovalResponse,
  InstagramStoryCaptureStatus,
} from '@/lib/instagram/contracts'
import { revalidateProduct } from '@/lib/revalidate'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 120

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface ApprovalClaim {
  capture_id: string
  capture_status: InstagramStoryCaptureStatus
  transitioned: boolean
  should_render: boolean
  jpeg_storage_path: string
  jpeg_public_url: string | null
  approved_at: string
  generated_at: string | null
  updated_at: string
  last_error: string | null
}

interface ApprovalProduct {
  id: string
  brand: string
  model: string | null
  slug: string | null
  price: number
  condition: string
  product_type: string
  seller_id: string | null
  product_images: { url: string; order: number }[] | null
  users:
    | { name: string | null; email: string | null }
    | { name: string | null; email: string | null }[]
    | null
}

function rpcMessage(error: { message?: string } | null): { message: string; status: number; code: string } {
  const raw = error?.message || ''
  if (raw.includes('PRODUCT_NOT_FOUND')) {
    return { message: 'Producto no encontrado', status: 404, code: 'PRODUCT_NOT_FOUND' }
  }
  if (raw.includes('CAPTURE_GENERATION_BUSY')) {
    return {
      message: 'Ya se está generando otra Story. Espera a que termine.',
      status: 409,
      code: 'CAPTURE_GENERATION_BUSY',
    }
  }
  if (raw.includes('PRODUCT_NOT_APPROVABLE')) {
    return {
      message: 'El producto ya no se puede aprobar desde este estado.',
      status: 409,
      code: 'PRODUCT_NOT_APPROVABLE',
    }
  }
  return { message: 'No pudimos aprobar el producto', status: 500, code: 'APPROVAL_FAILED' }
}

async function sendApprovalEmail(product: ApprovalProduct): Promise<boolean> {
  const seller = Array.isArray(product.users) ? product.users[0] ?? null : product.users
  if (!seller?.email) return false

  const images = product.product_images ?? []
  const imageUrl = [...images].sort((a, b) => a.order - b.order)[0]?.url ?? null
  const { subject, html, text } = buildApprovedEmail(seller.name, {
    brand: product.brand,
    model: product.model,
    price: product.price,
    condition: product.condition,
    productType: product.product_type,
    imageUrl,
    path: `/producto/${product.slug || product.id}`,
  })
  const result = await sendEmail({
    to: seller.email,
    subject,
    html,
    text,
    bcc: 'reskichile@gmail.com',
  })
  if (!result.ok) {
    console.error('[approve] approval email could not be sent')
  }
  return result.ok
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
    const { data: productData, error: productError } = await service
      .from('products')
      .select('id, brand, model, slug, price, condition, product_type, seller_id, product_images (url, order), users:seller_id (name, email)')
      .eq('id', id)
      .maybeSingle()
    if (productError || !productData) {
      return NextResponse.json(
        { error: 'Producto no encontrado', code: 'PRODUCT_NOT_FOUND' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    const product = productData as unknown as ApprovalProduct

    const { data: claimData, error: claimError } = await service.rpc(
      'instagram_begin_approval_capture',
      { p_product_id: id },
    )
    const claim = (Array.isArray(claimData) ? claimData[0] : claimData) as ApprovalClaim | null
    if (claimError || !claim) {
      const known = rpcMessage(claimError)
      return NextResponse.json(
        { error: known.message, code: known.code },
        { status: known.status, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    if (claim.transitioned) {
      revalidateProduct({ id: product.id, slug: product.slug })
    }

    let emailed = false
    let story = captureResultFromDatabaseRow({
      id: claim.capture_id,
      status: claim.capture_status,
      jpeg_public_url: claim.jpeg_public_url,
      updated_at: claim.updated_at,
    })

    if (claim.should_render) {
      const [emailResult, storyResult] = await Promise.all([
        claim.transitioned ? sendApprovalEmail(product) : Promise.resolve(false),
        generateAndStoreStoryCapture({
          captureId: claim.capture_id,
          productId: product.id,
          slug: product.slug || '',
          storagePath: claim.jpeg_storage_path,
        }),
      ])
      emailed = emailResult
      story = storyResult
    } else if (claim.last_error) {
      story = { ...story, error: claim.last_error }
    }

    if (story.status === 'generating') {
      return NextResponse.json(
        {
          error: 'La Story de este producto todavía se está generando.',
          code: 'CAPTURE_GENERATION_IN_PROGRESS',
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const response: AdminApprovalResponse = {
      ok: true,
      approved: true,
      transitioned: claim.transitioned,
      emailed,
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
