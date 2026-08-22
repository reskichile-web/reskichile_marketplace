import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ publish: vi.fn() }))

vi.mock('@/lib/instagram/publish-stories', () => ({
  publishEligibleInstagramStories: mocks.publish,
}))

import { GET } from '@/app/api/cron/instagram-publish/route'

const secret = 'c'.repeat(48)

function request(authorization?: string) {
  return new Request('https://www.reskichile.cl/api/cron/instagram-publish', {
    headers: authorization ? { Authorization: authorization } : {},
  })
}

describe('Instagram cron endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', secret)
    vi.stubEnv('INSTAGRAM_PUBLISHING_ENABLED', 'false')
    vi.stubEnv('META_INSTAGRAM_ACCESS_TOKEN', '')
    vi.stubEnv('META_INSTAGRAM_USER_ID', '')
    mocks.publish.mockResolvedValue({ ok: true, disabled: true })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('rejects requests without the bearer secret', async () => {
    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it('rejects requests with a different bearer secret', async () => {
    const response = await GET(request(`Bearer ${'x'.repeat(48)}`))

    expect(response.status).toBe(401)
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it('fails closed when CRON_SECRET is missing', async () => {
    vi.stubEnv('CRON_SECRET', '')

    const response = await GET(request(`Bearer ${secret}`))

    expect(response.status).toBe(500)
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it('accepts Vercel authorization and keeps publishing disabled by configuration', async () => {
    const response = await GET(request(`Bearer ${secret}`))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ ok: true, disabled: true })
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({
      enabled: false,
      accessToken: null,
      userId: null,
    }))
  })
})
