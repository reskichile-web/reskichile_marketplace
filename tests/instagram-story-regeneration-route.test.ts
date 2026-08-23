import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  generate: vi.fn(),
  schedule: vi.fn(),
}))

vi.mock('@/lib/admin-security', () => ({
  assertSameOrigin: vi.fn(),
  requireAdmin: vi.fn(async () => ({ id: 'admin-id', email: 'admin@example.com' })),
  readSmallJson: async (request: Request) => request.json(),
  adminErrorResponse: (error: unknown) => ({
    message: error instanceof Error ? error.message : 'Error',
    code: 'INTERNAL_ERROR',
    status: 500,
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}))

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

vi.mock('@/lib/instagram/scheduling', () => ({ scheduleCaptureNext: mocks.schedule }))

import { POST } from '@/app/api/admin/products/[id]/instagram-story/retry/route'

const productId = '92000000-0000-4000-8000-000000000001'
const captureId = '93000000-0000-4000-8000-000000000001'
const now = '2026-08-22T12:00:00.000Z'

describe('Instagram Story regeneration route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: productId, brand: 'Dynafit', model: 'Radical', slug: 'dynafit-radical', status: 'approved' },
            error: null,
          }),
        }),
      }),
    })
    mocks.rpc.mockResolvedValue({
      data: [{
        capture_id: captureId,
        capture_status: 'generating',
        should_render: true,
        jpeg_storage_path: `_instagram/products/${productId}/story.jpg`,
        jpeg_public_url: 'https://storage.example/old-story.jpg',
        approved_at: now,
        generated_at: null,
        updated_at: now,
        last_error: null,
      }],
      error: null,
    })
    mocks.generate.mockResolvedValue({
      id: captureId,
      status: 'ready',
      jpegPublicUrl: 'https://storage.example/new-story.jpg',
      updatedAt: now,
      width: 1080,
      height: 1920,
      format: 'jpeg',
    })
  })

  it('claims forced regeneration and requests deletion/replacement of the existing JPEG', async () => {
    const request = new Request(`https://www.reskichile.cl/api/admin/products/${productId}/instagram-story/retry`, {
      method: 'POST',
      headers: { Origin: 'https://www.reskichile.cl', 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule: false, force: true }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: productId }) })

    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith(
      'instagram_begin_capture_regeneration',
      { p_product_id: productId },
    )
    expect(mocks.generate).toHaveBeenCalledWith({
      captureId,
      productId,
      slug: 'dynafit-radical',
      storagePath: `_instagram/products/${productId}/story.jpg`,
      replaceExisting: true,
    })
    expect(mocks.schedule).not.toHaveBeenCalled()
  })

  it('reports a missing regeneration migration instead of hiding it as a generic 500', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.instagram_begin_capture_regeneration(p_product_id) in the schema cache',
      },
    })

    const request = new Request(`https://www.reskichile.cl/api/admin/products/${productId}/instagram-story/retry`, {
      method: 'POST',
      headers: { Origin: 'https://www.reskichile.cl', 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule: false, force: true }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: productId }) })
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload).toEqual({
      error: 'Falta aplicar la migración de regeneración de Stories.',
      code: 'STORY_REGENERATION_MIGRATION_REQUIRED',
    })
    expect(mocks.generate).not.toHaveBeenCalled()
  })
})
