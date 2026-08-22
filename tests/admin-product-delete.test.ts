import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  remove: vi.fn(),
  revalidate: vi.fn(),
  captureDelete: vi.fn(),
  imageDelete: vi.fn(),
  productDelete: vi.fn(),
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
  createServiceRoleClient: () => ({
    from: mocks.from,
    storage: { from: () => ({ remove: mocks.remove }) },
  }),
}))
vi.mock('@/lib/revalidate', () => ({ revalidateProduct: mocks.revalidate }))

import { DELETE } from '@/app/api/admin/products/[id]/route'

const productId = '92000000-0000-4000-8000-000000000001'

function selectable<T>(data: T) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data, error: null }),
        then: (resolve: (value: { data: T; error: null }) => unknown) =>
          Promise.resolve(resolve({ data, error: null })),
      }),
    }),
  }
}

describe('admin product deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.remove.mockResolvedValue({ error: null })
    mocks.captureDelete.mockResolvedValue({ error: null })
    mocks.imageDelete.mockResolvedValue({ error: null })
    mocks.productDelete.mockResolvedValue({ error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          ...selectable({ id: productId, slug: 'dynafit-radical' }),
          delete: () => ({ eq: mocks.productDelete }),
        }
      }
      if (table === 'product_images') {
        return {
          select: () => ({
            eq: async () => ({
              data: [{
                url: 'https://project.supabase.co/storage/v1/object/public/product-images/products%2Fphoto.jpg',
              }],
              error: null,
            }),
          }),
          delete: () => ({ eq: mocks.imageDelete }),
        }
      }
      return {
        ...selectable({ jpeg_storage_path: `_instagram/products/${productId}/story.jpg` }),
        delete: () => ({ eq: mocks.captureDelete }),
      }
    })
  })

  it('removes the Story and product images before deleting database rows', async () => {
    const response = await DELETE(
      new Request(`https://www.reskichile.cl/api/admin/products/${productId}`, {
        method: 'DELETE',
        headers: { Origin: 'https://www.reskichile.cl' },
      }),
      { params: Promise.resolve({ id: productId }) },
    )

    expect(response.status).toBe(200)
    expect(mocks.remove).toHaveBeenCalledTimes(1)
    expect(mocks.remove).toHaveBeenCalledWith(expect.arrayContaining([
      `_instagram/products/${productId}/story.jpg`,
      'products/photo.jpg',
    ]))
    expect(mocks.captureDelete).toHaveBeenCalledWith('product_id', productId)
    expect(mocks.imageDelete).toHaveBeenCalledWith('product_id', productId)
    expect(mocks.productDelete).toHaveBeenCalledWith('id', productId)
    expect(mocks.revalidate).toHaveBeenCalledWith({ id: productId, slug: 'dynafit-radical' })
  })
})
