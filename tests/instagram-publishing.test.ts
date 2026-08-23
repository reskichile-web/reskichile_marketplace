import { describe, expect, it, vi } from 'vitest'

import {
  publishEligibleInstagramStories,
  publishInstagramStoryNow,
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
    scheduled_local_date: '2026-08-22',
    scheduled_slot: 1,
    scheduled_for: '2026-08-22T16:30:00.000Z',
    schedule_source: 'automatic',
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
  rescheduleExpired = vi.fn(async (now: Date) => {
    let count = 0
    for (const row of this.rows) {
      if (
        (row.status === 'ready' || row.status === 'retry')
        && row.scheduled_for
        && new Date(row.scheduled_for).getTime() + 59 * 60_000 < now.getTime()
      ) {
        row.scheduled_local_date = '2026-08-23'
        row.scheduled_slot = 1
        row.scheduled_for = '2026-08-23T23:00:00.000Z'
        row.container_id = null
        count += 1
      }
    }
    return count
  })

  constructor(rows: StoredCapture[]) {
    this.rows = rows
    for (const row of rows) this.approvedProducts.set(row.product_id, true)
  }

  async rescheduleCapture(captureId: string) {
    const row = this.required(captureId)
    row.status = 'retry'
    row.scheduled_local_date = '2026-08-23'
    row.scheduled_slot = 1
    row.scheduled_for = '2026-08-23T23:00:00.000Z'
    row.container_id = null
  }

  async listEligible(now: Date, limit: number) {
    this.cutoffs.push(now)
    const earliest = now.getTime() - 59 * 60_000
    return this.rows
      .filter((row) =>
        (row.status === 'ready' || row.status === 'retry')
        && row.scheduled_for
        && new Date(row.scheduled_for).getTime() >= earliest
        && new Date(row.scheduled_for).getTime() <= now.getTime()
        && !row.published_at
        && !row.media_id
        && this.approvedProducts.get(row.product_id) === true)
      .sort((left, right) => (left.scheduled_for || '').localeCompare(right.scheduled_for || ''))
      .slice(0, limit) as PublishableStoryCapture[]
  }

  async getPublishable(captureId: string) {
    const row = this.rows.find((item) => item.id === captureId)
    if (!row || (row.status !== 'ready' && row.status !== 'retry') || row.published_at || row.media_id) return null
    if (this.approvedProducts.get(row.product_id) !== true) return null
    return row as PublishableStoryCapture
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
  const fixedNow = () => new Date('2026-08-22T17:00:00.000Z')

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
      { repository, metaClient: meta, now: fixedNow },
    )

    expect(result.disabled).toBe(true)
    expect(repository.recoverInterrupted).not.toHaveBeenCalled()
    expect(meta.getPublishingLimit).not.toHaveBeenCalled()
  })

  it('publishes only the oldest due slot and excludes future or unapproved products', async () => {
    const due = capture({ id: 'due', product_id: 'approved' })
    const secondDue = capture({ id: 'second-due', product_id: 'second-approved', scheduled_for: '2026-08-22T16:45:00.000Z' })
    const future = capture({ id: 'future', product_id: 'future-product', scheduled_for: '2026-08-22T18:00:00.000Z' })
    const unapproved = capture({ id: 'unapproved', product_id: 'sold' })
    const repository = new MemoryRepository([due, secondDue, future, unapproved])
    repository.approvedProducts.set('sold', false)
    const meta = metaClient()

    const result = await publishEligibleInstagramStories(enabledConfig, {
      repository,
      metaClient: meta,
      now: fixedNow,
    })

    expect(result).toMatchObject({ candidates: 1, claimed: 1, published: 1 })
    expect(due.media_id).toBe('media-1')
    expect(secondDue.status).toBe('ready')
    expect(future.status).toBe('ready')
    expect(unapproved.status).toBe('ready')
  })

  it('stops before reading the queue when the publishing quota is exhausted', async () => {
    const repository = new MemoryRepository([capture()])
    const meta = metaClient({ getPublishingLimit: vi.fn(async () => 100) })

    const result = await publishEligibleInstagramStories(enabledConfig, { repository, metaClient: meta, now: fixedNow })

    expect(result.quotaUsage).toBe(100)
    expect(result.candidates).toBe(0)
    expect(repository.recoverInterrupted).not.toHaveBeenCalled()
  })

  it('reuses an existing container instead of creating another one', async () => {
    const row = capture({ container_id: 'existing-container' })
    const repository = new MemoryRepository([row])
    const meta = metaClient()

    await publishEligibleInstagramStories(enabledConfig, { repository, metaClient: meta, now: fixedNow })

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

    const result = await publishEligibleInstagramStories(enabledConfig, { repository, metaClient: meta, now: fixedNow })

    expect(result.recoveredPublished).toBe(1)
    expect(meta.createStoryContainer).not.toHaveBeenCalled()
    expect(meta.publishContainer).not.toHaveBeenCalled()
    expect(row.published_at).not.toBeNull()
  })

  it('marks the third failure as failed and lets the next invocation continue', async () => {
    const broken = capture({ id: 'broken', product_id: 'broken-product', attempts: 2 })
    const healthy = capture({ id: 'healthy', product_id: 'healthy-product' })
    const repository = new MemoryRepository([broken, healthy])
    const create = vi.fn()
      .mockRejectedValueOnce(new MetaApiError('Fallo transitorio', 503, 2, true, false))
      .mockResolvedValueOnce('healthy-container')
    const meta = metaClient({ createStoryContainer: create })

    const first = await publishEligibleInstagramStories(enabledConfig, { repository, metaClient: meta, now: fixedNow })
    const second = await publishEligibleInstagramStories(enabledConfig, { repository, metaClient: meta, now: fixedNow })

    expect(first).toMatchObject({ candidates: 1, claimed: 1, failed: 1, published: 0 })
    expect(second).toMatchObject({ candidates: 1, claimed: 1, published: 1 })
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

  it('reassigns an expired slot instead of publishing it late', async () => {
    const row = capture({ scheduled_for: '2026-08-22T15:59:59.000Z' })
    const repository = new MemoryRepository([row])
    const meta = metaClient()

    const result = await publishEligibleInstagramStories(enabledConfig, {
      repository,
      metaClient: meta,
      now: fixedNow,
    })

    expect(repository.rescheduleExpired).toHaveBeenCalled()
    expect(result.candidates).toBe(0)
    expect(row.scheduled_local_date).toBe('2026-08-23')
    expect(meta.createStoryContainer).not.toHaveBeenCalled()
  })

  it('allows an explicitly selected prepared Story to publish immediately', async () => {
    const row = capture({ scheduled_local_date: null, scheduled_slot: null, scheduled_for: null, schedule_source: null })
    const repository = new MemoryRepository([row])
    const meta = metaClient()

    const result = await publishInstagramStoryNow(enabledConfig, row.id, {
      repository,
      metaClient: meta,
      now: fixedNow,
    })

    expect(result).toMatchObject({ candidates: 1, claimed: 1, published: 1 })
    expect(repository.rescheduleExpired).not.toHaveBeenCalled()
  })
})
