import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  updatePassword: vi.fn(),
  updateProfile: vi.fn(),
  eqUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    auth: {
      getUser: mocks.getUser,
      updateUser: mocks.updatePassword,
    },
    from: () => ({
      update: mocks.updateProfile,
    }),
  }),
}))

import { POST } from '@/app/api/auth/change-password/route'

function request(password = 'NuevaClave1') {
  return new Request('https://www.reskichile.cl/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
}

describe('authenticated password changes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mocks.updatePassword.mockResolvedValue({ error: null })
    mocks.eqUser.mockResolvedValue({ error: null })
    mocks.updateProfile.mockReturnValue({ eq: mocks.eqUser })
  })

  it('rejects a request without an authenticated user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'missing session' } })

    const response = await POST(request())

    expect(response.status).toBe(401)
    expect(mocks.updatePassword).not.toHaveBeenCalled()
  })

  it('updates only the authenticated account', async () => {
    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(mocks.updatePassword).toHaveBeenCalledWith({ password: 'NuevaClave1' })
    expect(mocks.updateProfile).toHaveBeenCalledWith({ must_change_password: false })
    expect(mocks.eqUser).toHaveBeenCalledWith('id', 'user-1')
  })
})
