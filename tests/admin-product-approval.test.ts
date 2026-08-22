import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  sendEmail: vi.fn(),
  generate: vi.fn(),
  revalidate: vi.fn(),
}))

vi.mock('@/lib/admin-security', () => ({
  assertSameOrigin: vi.fn(),
  requireAdmin: vi.fn().mockResolvedValue({ id: 'admin-id', email: 'admin@example.com' }),
  adminErrorResponse: (error: unknown) => ({
    message: error instanceof Error ? error.message : 'Error',
    code: 'INTERNAL_ERROR',
    status: 500,
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}))

vi.mock('@/lib/email/send', () => ({ sendEmail: mocks.sendEmail }))
vi.mock('@/lib/email/templates', () => ({
  buildApprovedEmail: () => ({ subject: 'Aprobado', html: '<p>Aprobado</p>', text: 'Aprobado' }),
}))
vi.mock('@/lib/revalidate', () => ({ revalidateProduct: mocks.revalidate }))
vi.mock('@/lib/instagram/capture', () => ({
  captureResultFromDatabaseRow: (row: {
    id: string
    status: string
    jpeg_public_url: string | null
    updated_at: string
  }) => ({
    id: row.id,
    status: row.status,
    jpegPublicUrl: row.jpeg_public_url,
    updatedAt: row.updated_at,
    width: 1080,
    height: 1920,
    format: 'jpeg',
  }),
  generateAndStoreStoryCapture: mocks.generate,
}))

import { POST } from '@/app/api/admin/products/[id]/approve/route'

const productId = '92000000-0000-4000-8000-000000000001'
const now = '2026-08-21T15:00:00.000Z'
const product = {
  id: productId,
  brand: 'Dynafit',
  model: 'Radical',
  slug: 'dynafit-radical',
  price: 700000,
  condition: 'usado',
  product_type: 'esquis',
  seller_id: 'seller-id',
  product_images: [{ url: 'https://storage.example/product.png', order: 0 }],
  users: { name: 'Seller', email: 'seller@example.com' },
}

function productQuery() {
  return {
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: product, error: null }) }),
    }),
  }
}

function request() {
  return new Request(`https://www.reskichile.cl/api/admin/products/${productId}/approve`, {
    method: 'POST',
    headers: { Origin: 'https://www.reskichile.cl' },
  })
}

describe('admin product approval Story contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.from.mockReturnValue(productQuery())
    mocks.sendEmail.mockResolvedValue({ ok: true })
  })

  it('returns an existing ready capture without rendering or resending email', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        capture_id: 'capture-id',
        capture_status: 'ready',
        transitioned: false,
        should_render: false,
        jpeg_storage_path: `_instagram/products/${productId}/story.jpg`,
        jpeg_public_url: 'https://storage.example/story.jpg',
        approved_at: now,
        generated_at: now,
        updated_at: now,
        last_error: null,
      }],
      error: null,
    })

    const response = await POST(request(), { params: Promise.resolve({ id: productId }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.story.status).toBe('ready')
    expect(body.transitioned).toBe(false)
    expect(mocks.generate).not.toHaveBeenCalled()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })

  it('keeps approval successful when rendering fails', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        capture_id: 'capture-id',
        capture_status: 'generating',
        transitioned: true,
        should_render: true,
        jpeg_storage_path: `_instagram/products/${productId}/story.jpg`,
        jpeg_public_url: null,
        approved_at: now,
        generated_at: null,
        updated_at: now,
        last_error: null,
      }],
      error: null,
    })
    mocks.generate.mockResolvedValue({
      id: 'capture-id',
      status: 'failed',
      jpegPublicUrl: null,
      updatedAt: now,
      width: 1080,
      height: 1920,
      format: 'jpeg',
      error: 'Render fallido',
    })

    const response = await POST(request(), { params: Promise.resolve({ id: productId }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.approved).toBe(true)
    expect(body.story.status).toBe('failed')
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({
      productId,
      storagePath: `_instagram/products/${productId}/story.jpg`,
    }))
  })
})
