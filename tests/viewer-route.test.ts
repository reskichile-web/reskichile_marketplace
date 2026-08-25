import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  single: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient() {
    return {
      auth: { getUser: mocks.getUser },
      from: () => ({
        select: () => ({
          eq: () => ({ single: mocks.single }),
        }),
      }),
    }
  },
}))

import { GET } from '@/app/api/auth/viewer/route'

describe('GET /api/auth/viewer', () => {
  beforeEach(() => {
    mocks.getUser.mockReset()
    mocks.single.mockReset()
  })

  it('returns anonymous when there is no server session', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })

    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    await expect(response.json()).resolves.toEqual({ userId: null, isAdmin: false })
    expect(mocks.single).not.toHaveBeenCalled()
  })

  it('returns the server-authenticated viewer and admin flag', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-1' } }, error: null })
    mocks.single.mockResolvedValue({ data: { is_admin: true }, error: null })

    const response = await GET()

    await expect(response.json()).resolves.toEqual({ userId: 'owner-1', isAdmin: true })
  })

  it('fails closed when session validation throws', async () => {
    mocks.getUser.mockRejectedValue(new Error('network'))

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ userId: null, isAdmin: false })
  })
})
