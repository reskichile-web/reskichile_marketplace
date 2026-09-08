import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  insertEvent: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({ auth: { getUser: mocks.getUser } }),
  createServiceRoleClient: () => ({
    from: () => ({ insert: mocks.insertEvent }),
  }),
}))

import { POST } from '@/app/api/track/route'

const productId = '97000000-0000-4000-8000-000000000001'
const userId = '97000000-0000-4000-8000-000000000002'
const visitorId = '97000000-0000-4000-8000-000000000003'

function request(body: Record<string, unknown>) {
  return new Request('http://localhost:4173/api/track', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:4173',
      'User-Agent': 'Reski test browser',
      Cookie: `rv_id=${visitorId}`,
    },
    body: JSON.stringify(body),
  })
}

describe('contact intent tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    mocks.insertEvent.mockResolvedValue({ error: null })
  })

  it('records the verified user on a signed-in contact intent', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null })

    const response = await POST(request({
      type: 'click',
      name: 'contact_intent_whatsapp',
      path: `/producto/${productId}`,
      product_id: productId,
      category: 'esquis',
    }) as never)

    expect(response.status).toBe(204)
    expect(mocks.insertEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_name: 'contact_intent_whatsapp',
      visitor_id: visitorId,
      user_id: userId,
    }))
  })

  it('records a guest intent without a user id', async () => {
    await POST(request({
      type: 'click',
      name: 'contact_intent_whatsapp',
      path: `/producto/${productId}`,
      product_id: productId,
    }) as never)

    expect(mocks.insertEvent).toHaveBeenCalledWith(expect.objectContaining({ user_id: null }))
  })

  it('does not add an auth lookup to high-volume page views', async () => {
    await POST(request({ type: 'pageview', path: '/' }) as never)

    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.insertEvent).toHaveBeenCalledWith(expect.objectContaining({ user_id: null }))
  })

  it('drops forged or invented contact intents instead of polluting the funnel', async () => {
    const forged = request({
      type: 'click',
      name: 'contact_intent_whatsapp',
      path: `/producto/${productId}`,
      product_id: productId,
    })
    forged.headers.set('Origin', 'https://attacker.example')

    await POST(forged as never)
    await POST(request({
      type: 'click',
      name: 'contact_intent_other',
      path: `/producto/${productId}`,
      product_id: productId,
    }) as never)

    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.insertEvent).not.toHaveBeenCalled()
  })
})
