import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  insertEvent: vi.fn(),
  messageCount: 1,
  buyerId: 'buyer-1',
  isAdmin: false,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => ({ from: mocks.from }),
}))

import { recordFirstBuyerChatContact } from '@/lib/chat-contact-analytics'

const conversationId = 'conversation-1'
const productId = '96000000-0000-4000-8000-000000000001'

function request() {
  return new Request('https://www.reskichile.cl/api/chat/message', {
    method: 'POST',
    headers: {
      referer: 'https://www.reskichile.cl/mensajes/nuevo?product=product-1',
      'user-agent': 'Reski test browser',
      'x-vercel-ip-country': 'CL',
      'x-vercel-ip-city': 'Santiago',
    },
  })
}

describe('internal chat contact analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.messageCount = 1
    mocks.buyerId = 'buyer-1'
    mocks.isAdmin = false
    mocks.insertEvent.mockResolvedValue({ error: null })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: conversationId,
                  buyer_id: mocks.buyerId,
                  product_id: productId,
                  products: {
                    id: productId,
                    slug: 'k2-reckoner',
                    product_type: 'esquis',
                  },
                },
              }),
            }),
          }),
        }
      }

      if (table === 'messages') {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ count: mocks.messageCount }),
            }),
          }),
        }
      }

      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { is_admin: mocks.isAdmin } }),
            }),
          }),
        }
      }

      if (table === 'events') return { insert: mocks.insertEvent }
      throw new Error(`Unexpected table: ${table}`)
    })
  })

  it('records the buyer first message with campaign attribution', async () => {
    const created = await recordFirstBuyerChatContact({
      request: request(),
      conversationId,
      senderId: 'buyer-1',
      attribution: {
        utm_source: 'meta',
        utm_medium: 'paid_social',
        utm_campaign: 'compradores_invierno_2026',
        utm_content: 'catalogo',
        attribution_at: '2026-08-26T15:00:00.000Z',
      },
    })

    expect(created).toBe(true)
    expect(mocks.insertEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'click',
      event_name: 'chat_contact',
      path: '/producto/k2-reckoner',
      product_id: productId,
      user_id: 'buyer-1',
      utm_source: 'meta',
      utm_campaign: 'compradores_invierno_2026',
    }))
  })

  it('does not count replies or later buyer messages again', async () => {
    mocks.messageCount = 2

    const created = await recordFirstBuyerChatContact({
      request: request(),
      conversationId,
      senderId: 'buyer-1',
      attribution: null,
    })

    expect(created).toBe(false)
    expect(mocks.insertEvent).not.toHaveBeenCalled()
  })

  it('does not count seller or admin messages as buyer contacts', async () => {
    const sellerCreated = await recordFirstBuyerChatContact({
      request: request(),
      conversationId,
      senderId: 'seller-1',
      attribution: null,
    })
    mocks.isAdmin = true
    const adminCreated = await recordFirstBuyerChatContact({
      request: request(),
      conversationId,
      senderId: 'buyer-1',
      attribution: null,
    })

    expect(sellerCreated).toBe(false)
    expect(adminCreated).toBe(false)
    expect(mocks.insertEvent).not.toHaveBeenCalled()
  })
})
