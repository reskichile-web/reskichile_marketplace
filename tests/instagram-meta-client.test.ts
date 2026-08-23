import { describe, expect, it, vi } from 'vitest'

import { createInstagramMetaClient, MetaApiError } from '@/lib/instagram/meta-client'
import type { InstagramPublishingConfig } from '@/lib/instagram/publishing-config'

const fakeToken = 'fake-token-used-only-by-unit-tests'
const config: InstagramPublishingConfig = {
  enabled: true,
  accessToken: fakeToken,
  userId: '17841466542260568',
  apiVersion: 'v26.0',
  publishingQuota: 100,
  maxAttempts: 3,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Instagram Meta client', () => {
  it('uses the token only in the Authorization header and builds Story requests correctly', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: [{ quota_usage: 4 }] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'container-id' }))
      .mockResolvedValueOnce(jsonResponse({ status_code: 'FINISHED', status: 'Finished' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'media-id' }))
    const client = createInstagramMetaClient(config, fetchMock as typeof fetch)

    await expect(client.getPublishingLimit()).resolves.toBe(4)
    await expect(client.createStoryContainer('https://storage.example/story.jpg')).resolves.toBe('container-id')
    await expect(client.getContainerStatus('container-id')).resolves.toEqual({
      statusCode: 'FINISHED',
      status: 'Finished',
    })
    await expect(client.publishContainer('container-id')).resolves.toBe('media-id')

    for (const [url, init] of fetchMock.mock.calls as Array<[string, RequestInit]>) {
      expect(url).not.toContain(fakeToken)
      expect(init.body || '').not.toContain(fakeToken)
      expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${fakeToken}`)
    }
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://graph.instagram.com/v26.0/17841466542260568/media',
    )
    expect(fetchMock.mock.calls[1][1].body).toBe(
      'image_url=https%3A%2F%2Fstorage.example%2Fstory.jpg&media_type=STORIES',
    )
    expect(fetchMock.mock.calls[3][0]).toBe(
      'https://graph.instagram.com/v26.0/17841466542260568/media_publish',
    )
  })

  it('accepts the legacy top-level publishing quota shape as a fallback', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ quota_usage: 7 }))
    const client = createInstagramMetaClient(config, fetchMock as typeof fetch)

    await expect(client.getPublishingLimit()).resolves.toBe(7)
  })

  it('sanitizes Meta errors before exposing them to the publisher', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      error: {
        message: 'Bad token access_token=sensitive at https://private.example/path',
        code: 190,
      },
    }, 401))
    const client = createInstagramMetaClient(config, fetchMock as typeof fetch)

    const error = await client.getPublishingLimit().catch((value) => value)

    expect(error).toBeInstanceOf(MetaApiError)
    expect(error.message).not.toContain('sensitive')
    expect(error.message).not.toContain('private.example')
    expect(error.message).toContain('[redacted]')
  })

  it('marks an interrupted POST as uncertain so the container can be reconciled later', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('network details') })
    const client = createInstagramMetaClient(config, fetchMock as typeof fetch)

    const error = await client.publishContainer('container-id').catch((value) => value)

    expect(error).toBeInstanceOf(MetaApiError)
    expect(error).toMatchObject({ retryable: true, uncertain: true, status: null })
    expect(error.message).toBe('Meta no confirmó la operación')
  })
})
