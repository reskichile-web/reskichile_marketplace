import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  insertEvent: vi.fn(),
  product: null as Record<string, unknown> | null,
  productError: null as { message: string } | null,
  seller: null as Record<string, unknown> | null,
  sellerError: null as { message: string } | null,
  buyerProfile: null as Record<string, unknown> | null,
  buyerProfileError: null as { message: string } | null,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser: mocks.getUser },
  }),
  createServiceRoleClient: () => ({
    rpc: mocks.rpc,
    from: mocks.from,
  }),
}))

import { POST } from '@/app/api/contact/[productId]/route'

const productId = '96000000-0000-4000-8000-000000000001'
const sellerId = '96000000-0000-4000-8000-000000000002'
const buyerId = '96000000-0000-4000-8000-000000000003'
const visitorId = '96000000-0000-4000-8000-000000000004'

function request(overrides: { origin?: string; userAgent?: string } = {}) {
  const origin = overrides.origin ?? 'http://localhost:4173'
  const headers = new Headers({
    Origin: origin,
    'Content-Type': 'application/json',
    'User-Agent': overrides.userAgent ?? 'Reski test browser',
    'X-Forwarded-For': '203.0.113.42',
    Cookie: `rv_id=${visitorId}`,
  })
  return new Request(`http://localhost:4173/api/contact/${productId}`, {
    method: 'POST',
    headers,
    body: '{}',
  })
}

function invoke(req = request()) {
  return POST(req, { params: Promise.resolve({ productId }) })
}

describe('guest WhatsApp contact route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('APP_URL', 'http://localhost:4173')
    vi.stubEnv('CONTACT_RATE_LIMIT_SECRET', 'contact-rate-limit-test-secret'.repeat(2))

    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    mocks.insertEvent.mockResolvedValue({ error: null })
    mocks.product = {
      id: productId,
      slug: 'k2-reckoner-102',
      brand: 'K2',
      model: 'Reckoner 102',
      product_type: 'esquis',
      seller_id: sellerId,
      anon_contact: null,
      status: 'approved',
    }
    mocks.productError = null
    mocks.seller = { phone: '+56 9 1234 5678', hide_phone: false }
    mocks.sellerError = null
    mocks.buyerProfile = { is_admin: false }
    mocks.buyerProfileError = null

    mocks.from.mockImplementation((table: string) => {
      if (table === 'products') {
        const builder = {
          eq: vi.fn(() => builder),
          maybeSingle: vi.fn(async () => ({
            data: mocks.product,
            error: mocks.productError,
          })),
        }
        return { select: () => builder }
      }

      if (table === 'users') {
        return {
          select: (columns: string) => ({
            eq: () => ({
              maybeSingle: async () => columns === 'is_admin'
                ? { data: mocks.buyerProfile, error: mocks.buyerProfileError }
                : { data: mocks.seller, error: mocks.sellerError },
            }),
          }),
        }
      }

      if (table === 'events') return { insert: mocks.insertEvent }
      throw new Error(`Unexpected table: ${table}`)
    })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('allows a visitor without an account and records the validated handoff', async () => {
    const response = await invoke()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(data.url).toMatch(/^https:\/\/wa\.me\/56912345678\?text=/)
    expect(mocks.rpc).toHaveBeenCalledTimes(3)
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain('203.0.113.42')
    expect(mocks.insertEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_name: 'whatsapp_contact',
      product_id: productId,
      visitor_id: visitorId,
      user_id: null,
    }))
  })

  it('keeps working as a guest if optional session validation is unavailable', async () => {
    mocks.getUser.mockRejectedValue(new Error('auth unavailable'))

    const response = await invoke()

    expect(response.status).toBe(200)
    expect(mocks.insertEvent).toHaveBeenCalledWith(expect.objectContaining({ user_id: null }))
  })

  it('attributes a signed-in non-admin contact to the verified user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: buyerId } }, error: null })

    const response = await invoke()

    expect(response.status).toBe(200)
    expect(mocks.insertEvent).toHaveBeenCalledWith(expect.objectContaining({ user_id: buyerId }))
  })

  it('uses the private server-side contact for an account-less seller', async () => {
    mocks.product = { ...mocks.product, seller_id: null, anon_contact: '+56987654321' }

    const response = await invoke()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.url).toMatch(/^https:\/\/wa\.me\/56987654321\?text=/)
  })

  it('does not count authenticated admin activity', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: buyerId } }, error: null })
    mocks.buyerProfile = { is_admin: true }

    const response = await invoke()

    expect(response.status).toBe(200)
    expect(mocks.insertEvent).not.toHaveBeenCalled()
  })

  it('prevents an authenticated seller from contacting their own listing', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: sellerId } }, error: null })

    const response = await invoke()

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'SELF_CONTACT' })
    expect(mocks.insertEvent).not.toHaveBeenCalled()
  })

  it('fails closed when any persistent rate-limit bucket is exhausted', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: true, error: null })

    const response = await invoke()

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toMatchObject({ code: 'RATE_LIMITED' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.insertEvent).not.toHaveBeenCalled()
  })

  it('does not expose a number when the seller disabled WhatsApp', async () => {
    mocks.seller = { phone: '+56912345678', hide_phone: true }

    const response = await invoke()

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'PHONE_HIDDEN' })
    expect(mocks.insertEvent).not.toHaveBeenCalled()
  })

  it('rejects cross-origin browser requests before consuming a rate-limit bucket', async () => {
    const response = await invoke(request({ origin: 'https://attacker.example' }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_ORIGIN' })
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects obvious automation before looking up the seller phone', async () => {
    const response = await invoke(request({ userAgent: 'ExampleBot/1.0' }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'AUTOMATION_BLOCKED' })
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
