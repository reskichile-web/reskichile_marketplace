import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    auth: {
      getUser: mocks.getUser,
      updateUser: mocks.updateUser,
    },
  }),
}))

import { POST } from '@/app/api/privacy/marketing-consent/route'

function request(choice: unknown, origin = 'http://localhost:4173') {
  return new Request('http://localhost:4173/api/privacy/marketing-consent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: JSON.stringify({ choice }),
  })
}

describe('account marketing consent', () => {
  beforeEach(() => {
    vi.stubEnv('APP_URL', 'http://localhost:4173')
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mocks.updateUser.mockResolvedValue({ error: null })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('stores the decision only in the authenticated account metadata', async () => {
    const response = await POST(request('granted') as never)

    expect(response.status).toBe(200)
    expect(mocks.updateUser).toHaveBeenCalledWith({
      data: {
        marketing_consent: {
          choice: 'granted',
          version: 1,
          decidedAt: expect.any(Number),
        },
      },
    })
  })

  it('rejects unauthenticated and invalid decisions', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const anonymousResponse = await POST(request('denied') as never)
    expect(anonymousResponse.status).toBe(401)

    const invalidResponse = await POST(request('maybe') as never)
    expect(invalidResponse.status).toBe(422)
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })
})
