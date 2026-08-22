import { describe, expect, it, vi } from 'vitest'

import {
  publishEligibleInstagramStories,
  startOfTodayInChile,
  type PublishableStoryCapture,
  type StoryPublishingRepository,
} from '@/lib/instagram/publish-stories'
import { MetaApiError, type InstagramMetaClient } from '@/lib/instagram/meta-client'
import type { InstagramPublishingConfig } from '@/lib/instagram/publishing-config'

const enabledConfig: InstagramPublishingConfig = {
  enabled: true,
  accessToken: 'unit-test-token',
  userId: '17841466542260568',
  apiVersion: 'v26.0',
  publishingQuota: 100,
  maxAttempts: 3,
}

interface StoredCapture extends Omit<PublishableStoryCapture, 'status'> {
  status: PublishableStoryCapture['status'] | 'published' | 'failed'
  published_at: string | null
  last_error: string | null
}

function capture(overrides: Partial<StoredCapture> = {}): StoredCapture {
  return {
    id: 'capture-1',
    product_id: 'product-1',
    jpeg_public_url: 'https://storage.example/story.jpg',
    status: 'ready',
    container_id: null,
    media_id: null,
    attempts: 0,
    approved_at: '2026-08-21T12:00:00.000Z',
    updated_at: '2026-08-21T12:05:00.000Z',
    published_at: null,
    last_error: null,
    ...overrides,
  }
}

class MemoryRepository implements StoryPublishingRepository {
  readonly rows: StoredCapture[]
  readonly approvedProducts = new Map<string, boolean>()
  readonly cutoffs: Date[] = []
  recoverInterrupted = vi.fn(async () => undefined)

  constructor(rows: StoredCapture[]) {
    this.rows = rows
    for (const row of rows) this.approvedProducts.set(row.product_id, true)
  }

  async listEligible(cutoff: Date, limit: number) {
    this.cutoffs.push(cutoff)
    return this.rows
      .filter((row) =>
        (row.status === 'ready' || row.status === 'retry')
        && new Date(row.approved_at) < cutoff
        && !row.published_at
        && !row.media_id
        && this.approvedProducts.get(row.product_id) === true)
      .sort((left, right) => left.approved_at.localeCompare(right.approved_at))
      .slice(0, limit) as PublishableStoryCapture[]
  }

  async claim(captureId: string) {
    const row = this.rows.find((item) => item.id === captureId)
    if (!row || (row.status !== 'ready' && row.status !== 'retry') || row.published_at || row.media_id) {
      return null
    }
    row.status = 'publishing'
    row.last_error = null
    return row as PublishableStoryCapture
  }

  async isProductApproved(productId: string) {
    return this.approvedProducts.get(productId) === true
  }

  async saveContainer(captureId: string, containerId: string) {
    const row = this.rows.find((item) => item.id === captureId)
    if (!row || row.status !== 'publishing' || row.container_id) return false
    row.container_id = containerId
    return true
  }

  async markPublished(captureId: string, containerId: string, mediaId: string, now: Date) {
    const row = this.required(captureId)
    row.status = 'published'
    row.container_id = containerId
    row.media_id = mediaId
    row.published_at = now.toISOString()
    row.last_error = null
  }

  async markRecoveredPublished(captureId: string, containerId: string, now: Date) {
    const row = this.required(captureId)
    row.status = 'published'
    row.container_id = containerId
    row.published_at = now.toISOString()
    row.last_error = 'Publicación recuperada'
  }

  async releaseUnapproved(captureId: string) {
    this.required(captureId).status = 'ready'
  }

  async markPending(captureId: string, message: string) {
    const row = this.required(captureId)
    row.status = 'retry'
    row.last_error = message
  }

  async markFailure(
    captureId: string,
    attempts: number,
    maxAttempts: number,
    message: string,
    clearContainer: boolean,
  ) {
    const row = this.required(captureId)
    row.attempts = attempts + 1
    row.status = row.attempts >= maxAttempts ? 'failed' : 'retry'
    row.last_error = message
    if (clearContainer) row.container_id = null
    return row.status === 'failed' ? 'failed' : 'retry'
  }

  private required(captureId: string) {
    const row = this.rows.find((item) => item.id === captureId)
    if (!row) throw new Error(`Missing capture ${captureId}`)
    return row
  }
}

function metaClient(overrides: Partial<InstagramMetaClient> = {}): InstagramMetaClient {
  return {
    getPublishingLimit: vi.fn(async () => 0),
    createStoryContainer: vi.fn(async () => 'container-1'),
    getContainerStatus: vi.fn(async () => ({ statusCode: 'FINISHED' as const, status: null })),
    publishContainer: vi.fn(async () => 'media-1'),
    ...overrides,
  }
}

describe('Instagram daily Story publisher', () => {
  it('calculates Chile midnight correctly across daylight-saving offsets', () => {
    expect(startOfTodayInChile(new Date('2026-08-22T17:00:00.000Z')).toISOString())
      .toBe('2026-08-22T04:00:00.000Z')
    expect(startOfTodayInChile(new Date('2026-01-22T17:00:00.000Z')).toISOString())
      .toBe('2026-01-22T03:00:00.000Z')
  })

  it('does no repository or Meta work while publishing is disabled', async () => {
    const repository = new MemoryRepository([capture()])
    const meta = metaClient()

    const result = await publishEligibleInstagramStories(
      { ...enabledConfig, enabled: false, accessToken: null, userId: null },
      { repository, metaClient: meta },
    )

    expect(result.disabled).toBe(true)
    expect(repository.recoverInterrupted).not.toHaveBeenCalled()
    expect(meta.getPublishingLimit).not.toHaveBeenCalled()
  })

  it('publishes old approved captures, excluding today and unapproved products', async () => {
    const old = capture({ id: 'old', product_id: 'approved', approved_at: '2026-08-21T23:00:00.000Z' })
    const today = capture({ id: 'today', product_id: 'today-product', approved_at: '2026-08-22T05:00:00.000Z' })
    const unapproved = capture({ id: 'unapproved', product_id: 'sold', approved_at: '2026-08-20T10:00:00.000Z' })
    const repository = new MemoryRepository([old, today, unapproved])
    repository.approvedProducts.set('sold', false)
    const meta = metaClient()

    const result = await publishEligibleInstagramStories(enabledConfig, {
      repository,
      metaClient: meta,
      now: () => new Date('2026-08-22T17:00:00.000Z'),
    })

    expect(repository.cutoffs[0].toISOString()).toBe('2026-08-22T04:00:00.000Z')
    expect(result).toMatchObject({ candidates: 1, claimed: 1, published: 1 })
    expect(old.media_id).toBe('media-1')
    expect(today.status).toBe('ready')
    expect(unapproved.status).toBe('ready')
  })

  it('stops before reading the queue when the publishing quota is exhausted', async () => {
    const repository = new MemoryRepository([capture()])
    const meta = metaClient({ getPublishingLimit: vi.fn(async () => 100) })

    const result = await publishEligibleInstagramStories(enabledConfig, { repository, metaClient: meta })

    expect(result.quotaUsage).toBe(100)
    expect(result.candidates).toBe(0)
    expect(repository.recoverInterrupted).not.toHaveBeenCalled()
  })

  it('reuses an existing container instead of creating another one', async () => {
    const row = capture({ container_id: 'existing-container' })
    const repository = new MemoryRepository([row])
    const meta = metaClient()

    await publishEligibleInstagramStories(enabledConfig, { repository, metaClient: meta })

    expect(meta.createStoryContainer).not.toHaveBeenCalled()
    expect(meta.getContainerStatus).toHaveBeenCalledWith('existing-container')
    expect(meta.publishContainer).toHaveBeenCalledWith('existing-container')
  })

  it('recovers a container already published without calling media_publish again', async () => {
    const row = capture({ container_id: 'already-published-container' })
    const repository = new MemoryRepository([row])
    const meta = metaClient({
      getContainerStatus: vi.fn(async () => ({ statusCode: 'PUBLISHED' as const, status: null })),
    })

    const result = await publishEligibleInstagramStories(enabledConfig, { repository, metaClient: meta })

    expect(result.recoveredPublished).toBe(1)
    expect(meta.createStoryContainer).not.toHaveBeenCalled()
    expect(meta.publishContainer).not.toHaveBeenCalled()
    expect(row.published_at).not.toBeNull()
  })

  it('marks the third failure as failed and continues with the next Story', async () => {
    const broken = capture({ id: 'broken', product_id: 'broken-product', attempts: 2 })
    const healthy = capture({ id: 'healthy', product_id: 'healthy-product' })
    const repository = new MemoryRepository([broken, healthy])
    const create = vi.fn()
      .mockRejectedValueOnce(new MetaApiError('Fallo transitorio', 503, 2, true, false))
      .mockResolvedValueOnce('healthy-container')
    const meta = metaClient({ createStoryContainer: create })

    const result = await publishEligibleInstagramStories(enabledConfig, { repository, metaClient: meta })

    expect(result).toMatchObject({ candidates: 2, claimed: 2, failed: 1, published: 1 })
    expect(broken.status).toBe('failed')
    expect(broken.attempts).toBe(3)
    expect(healthy.media_id).toBe('media-1')
  })

  it('leaves an in-progress container for a later run without creating a new one', async () => {
    const row = capture({ container_id: 'processing-container' })
    const repository = new MemoryRepository([row])
    const meta = metaClient({
      getContainerStatus: vi.fn(async () => ({ statusCode: 'IN_PROGRESS' as const, status: null })),
    })
    let currentTime = new Date('2026-08-22T17:00:00.000Z').getTime()

    const result = await publishEligibleInstagramStories(enabledConfig, {
      repository,
      metaClient: meta,
      now: () => new Date(currentTime),
      sleep: async (milliseconds) => { currentTime += milliseconds },
      runBudgetMs: 20_000,
      pollIntervalMs: 60_000,
    })

    expect(result.retry).toBe(1)
    expect(row.status).toBe('retry')
    expect(row.container_id).toBe('processing-container')
    expect(meta.getContainerStatus).toHaveBeenCalledTimes(1)
    expect(meta.createStoryContainer).not.toHaveBeenCalled()
    expect(meta.publishContainer).not.toHaveBeenCalled()
  })
})
