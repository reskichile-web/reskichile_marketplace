import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
  consume: vi.fn(),
  unschedule: vi.fn(),
}))

vi.mock('@/lib/admin-security', () => {
  class AdminRequestError extends Error {
    constructor(
      message: string,
      public readonly status: number,
      public readonly code: string,
    ) {
      super(message)
    }
  }
  return {
    AdminRequestError,
    assertSameOrigin: vi.fn(),
    requireAdmin: vi.fn(async () => ({ id: 'admin-id', email: 'admin@example.com' })),
    readSmallJson: async (request: Request) => request.json(),
    consumeAdminRateLimit: mocks.consume,
    adminErrorResponse: (error: unknown) => error instanceof AdminRequestError
      ? { message: error.message, status: error.status, code: error.code }
      : { message: 'No pudimos completar la operación', status: 500, code: 'INTERNAL_ERROR' },
  }
})

vi.mock('@/lib/instagram/publish-stories', () => ({
  publishInstagramStoryNow: mocks.publish,
}))
vi.mock('@/lib/instagram/scheduling', () => ({ unscheduleCapture: mocks.unschedule }))

import { POST } from '@/app/api/admin/instagram-stories/publish-now/route'

const captureId = '92000000-0000-4000-8000-000000000001'

function request(confirmation = 'PUBLICAR_EN_INSTAGRAM') {
  return new Request('https://www.reskichile.cl/api/admin/instagram-stories/publish-now', {
    method: 'POST',
    headers: { Origin: 'https://www.reskichile.cl', 'Content-Type': 'application/json' },
    body: JSON.stringify({ captureId, confirmation }),
  })
}

describe('manual Instagram Story publication endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'c'.repeat(48))
    vi.stubEnv('META_INSTAGRAM_ACCESS_TOKEN', 'unit-test-token')
    vi.stubEnv('META_INSTAGRAM_USER_ID', '17841466542260568')
    mocks.publish.mockResolvedValue({ published: 1, recoveredPublished: 0 })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('does not contact Meta while publishing is disabled', async () => {
    vi.stubEnv('INSTAGRAM_PUBLISHING_ENABLED', 'false')

    const response = await POST(request())

    expect(response.status).toBe(409)
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(mocks.consume).not.toHaveBeenCalled()
  })

  it('requires an explicit destructive-action confirmation', async () => {
    vi.stubEnv('INSTAGRAM_PUBLISHING_ENABLED', 'true')

    const response = await POST(request(''))

    expect(response.status).toBe(422)
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it('publishes one selected capture only after confirmation and rate limiting', async () => {
    vi.stubEnv('INSTAGRAM_PUBLISHING_ENABLED', 'true')

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(mocks.consume).toHaveBeenCalledWith(
      'admin-id',
      'instagram-publish-now',
      'c'.repeat(48),
      3,
      60,
    )
    expect(mocks.publish).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
      captureId,
    )
    expect(mocks.unschedule).toHaveBeenCalledWith(captureId)
  })
})
