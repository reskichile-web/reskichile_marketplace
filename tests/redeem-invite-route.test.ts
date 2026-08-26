import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  updatePassword: vi.fn(),
  updateUser: vi.fn(),
  updateInvite: vi.fn(),
  insertEvent: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { admin: { updateUserById: mocks.updatePassword } },
    from: mocks.from,
  }),
}))

import { POST } from '@/app/api/auth/redeem-invite/route'

const userId = 'ed338f17-9926-4f5b-9344-c051778f473b'
const slug = '3FTX8H7V'

function request() {
  return new Request('https://www.reskichile.cl/api/auth/redeem-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, password: 'NuevaClave1', phone: '+56912345678' }),
  })
}

describe('invite redemption activation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updatePassword.mockResolvedValue({ error: null })
    mocks.updateUser.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    mocks.updateInvite.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    mocks.insertEvent.mockResolvedValue({ error: null })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'password_invites') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  slug,
                  user_id: userId,
                  expires_at: '2099-01-01T00:00:00.000Z',
                  used_at: null,
                },
                error: null,
              }),
            }),
          }),
          update: mocks.updateInvite,
        }
      }

      if (table === 'users') {
        return {
          update: mocks.updateUser,
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { email: 'flo@example.com' }, error: null }),
            }),
          }),
        }
      }

      if (table === 'events') return { insert: mocks.insertEvent }
      throw new Error(`Unexpected table: ${table}`)
    })
  })

  it('marks an imported user active when the invite is redeemed', async () => {
    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(mocks.updateUser).toHaveBeenCalledWith({
      must_change_password: false,
      keep: true,
      phone: '+56912345678',
    })
    expect(mocks.updateInvite).toHaveBeenCalledWith({
      used_at: expect.any(String),
    })
  })

  it('does not consume the invite if activating the profile fails', async () => {
    mocks.updateUser.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'write failed' } }),
    })

    const response = await POST(request())

    expect(response.status).toBe(500)
    expect(mocks.updateInvite).not.toHaveBeenCalled()
  })

  it('rejects activation when a profile without phone submits none', async () => {
    const response = await POST(new Request('https://www.reskichile.cl/api/auth/redeem-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, password: 'NuevaClave1' }),
    }))

    expect(response.status).toBe(400)
    expect(mocks.updatePassword).not.toHaveBeenCalled()
    expect(mocks.updateInvite).not.toHaveBeenCalled()
  })
})
