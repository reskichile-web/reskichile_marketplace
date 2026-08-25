import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  getAll: vi.fn(),
  deleteCookie: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    auth: { signOut: mocks.signOut },
  }),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: mocks.getAll,
    delete: mocks.deleteCookie,
  }),
}))

import { POST } from '@/app/auth/logout/route'

describe('logout route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.signOut.mockResolvedValue({ error: null })
    mocks.getAll.mockReturnValue([
      { name: 'sb-project-auth-token', value: 'token' },
      { name: 'sb-project-auth-token.0', value: 'chunk' },
      { name: 'unrelated-cookie', value: 'keep' },
    ])
  })

  it('turns the native POST logout into a safe GET navigation', async () => {
    const response = await POST(new Request('https://www.reskichile.cl/auth/logout', { method: 'POST' }))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('https://www.reskichile.cl/')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })

  it('clears every Supabase auth cookie but preserves unrelated cookies', async () => {
    await POST(new Request('https://www.reskichile.cl/auth/logout', { method: 'POST' }))

    expect(mocks.deleteCookie).toHaveBeenCalledWith('sb-project-auth-token')
    expect(mocks.deleteCookie).toHaveBeenCalledWith('sb-project-auth-token.0')
    expect(mocks.deleteCookie).not.toHaveBeenCalledWith('unrelated-cookie')
  })

  it('returns JSON to the client logout helper', async () => {
    const response = await POST(new Request('https://www.reskichile.cl/auth/logout', {
      method: 'POST',
      headers: { Accept: 'application/json' },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('still clears the browser session when remote sign-out fails', async () => {
    mocks.signOut.mockRejectedValue(new Error('network'))

    const response = await POST(new Request('https://www.reskichile.cl/auth/logout', { method: 'POST' }))

    expect(response.status).toBe(303)
    expect(mocks.deleteCookie).toHaveBeenCalledWith('sb-project-auth-token')
  })
})
