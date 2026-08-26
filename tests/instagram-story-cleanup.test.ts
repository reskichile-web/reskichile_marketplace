import { describe, expect, it, vi } from 'vitest'
import { cleanupQueuedProductStories } from '@/lib/instagram/story-cleanup'

const productId = '96000000-0000-4000-8000-000000000001'
const validPath = `_instagram/products/${productId}/story-version.jpg`

function service(options: { storageError?: boolean } = {}) {
  const remove = vi.fn().mockResolvedValue({
    error: options.storageError ? { message: 'storage unavailable' } : null,
  })
  const deleteEq = vi.fn().mockResolvedValue({ error: null })
  const queue = {
    select: () => queue,
    order: () => queue,
    limit: () => queue,
    in: async () => ({
      data: [{
        product_id: productId,
        storage_paths: [validPath, '../unsafe.jpg'],
      }],
      error: null,
    }),
    delete: () => ({ eq: deleteEq }),
  }
  return {
    client: {
      from: () => queue,
      storage: { from: () => ({ remove }) },
    },
    remove,
    deleteEq,
  }
}

describe('Instagram Story cleanup queue', () => {
  it('removes only product-scoped paths and acknowledges the queue row', async () => {
    const fake = service()

    const summary = await cleanupQueuedProductStories({
      service: fake.client as never,
      productIds: [productId],
    })

    expect(summary).toEqual({ queued: 1, removed: 1, failed: 0 })
    expect(fake.remove).toHaveBeenCalledWith([validPath])
    expect(fake.deleteEq).toHaveBeenCalledWith('product_id', productId)
  })

  it('keeps the queue row when Storage is temporarily unavailable', async () => {
    const fake = service({ storageError: true })

    const summary = await cleanupQueuedProductStories({
      service: fake.client as never,
      productIds: [productId],
    })

    expect(summary).toEqual({ queued: 1, removed: 0, failed: 1 })
    expect(fake.deleteEq).not.toHaveBeenCalled()
  })
})
