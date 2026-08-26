import { describe, expect, it, vi } from 'vitest'
import { persistSignupProfile } from '@/lib/persist-signup-profile'

describe('persistSignupProfile', () => {
  it('updates only writable profile columns and verifies the stored phone', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { phone: '+56912345678' },
      error: null,
    })
    const select = vi.fn().mockReturnValue({ single })
    const eq = vi.fn().mockReturnValue({ select })
    const update = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ update })

    const saved = await persistSignupProfile(
      { from } as never,
      {
        id: '81000000-0000-4000-8000-000000000001',
        email: 'seller@example.com',
        name: 'Seller',
        phone: '+56912345678',
      },
    )

    expect(saved).toBe(true)
    expect(from).toHaveBeenCalledWith('users')
    expect(update).toHaveBeenCalledWith({
      email: 'seller@example.com',
      name: 'Seller',
      phone: '+56912345678',
    })
    expect(update.mock.calls[0][0]).not.toHaveProperty('id')
    expect(eq).toHaveBeenCalledWith('id', '81000000-0000-4000-8000-000000000001')
    expect(select).toHaveBeenCalledWith('phone')
  })

  it('fails closed when the database does not return the expected phone', async () => {
    const single = vi.fn().mockResolvedValue({ data: { phone: null }, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const eq = vi.fn().mockReturnValue({ select })
    const update = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ update })

    const saved = await persistSignupProfile(
      { from } as never,
      {
        id: '81000000-0000-4000-8000-000000000001',
        email: 'seller@example.com',
        name: 'Seller',
        phone: '+56912345678',
      },
    )

    expect(saved).toBe(false)
  })
})
