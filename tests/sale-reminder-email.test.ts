import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  insertTokens: vi.fn(),
  updateProduct: vi.fn(),
  updateEq: vi.fn(),
  tokenNumber: 0,
}))

vi.mock('@/lib/email/send', () => ({ sendEmail: mocks.sendEmail }))
vi.mock('@/lib/sold', () => ({
  generateToken: () => `token-${++mocks.tokenNumber}`,
}))

import {
  sendSaleReminderForProduct,
  type SaleReminderProduct,
} from '@/lib/sale-reminder-email'

const product: SaleReminderProduct = {
  id: '96000000-0000-4000-8000-000000000001',
  brand: 'Rossignol',
  model: 'Hero Elite',
  price: 249_990,
  anon_contact: null,
  product_images: [
    { url: 'https://example.com/second.jpg', order: 2 },
    { url: 'https://example.com/first.jpg', order: 1 },
  ],
  users: { email: 'seller@example.com' },
}

function serviceClient(): SupabaseClient {
  return {
    from: vi.fn((table: string) => {
      if (table === 'product_action_tokens') {
        return { insert: mocks.insertTokens }
      }
      if (table === 'products') {
        return {
          update: (patch: Record<string, unknown>) => {
            mocks.updateProduct(patch)
            return { eq: mocks.updateEq }
          },
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
  } as unknown as SupabaseClient
}

describe('canonical sale reminder sender', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.tokenNumber = 0
    mocks.insertTokens.mockResolvedValue({ error: null })
    mocks.sendEmail.mockResolvedValue({ ok: true, id: 'email-id' })
    mocks.updateEq.mockResolvedValue({ error: null })
  })

  it('creates both response links, sends the cron template, and resets the reminder clock', async () => {
    const result = await sendSaleReminderForProduct(serviceClient(), product)

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      recipient: 'seller@example.com',
      trackingUpdated: true,
    }))
    expect(mocks.insertTokens).toHaveBeenCalledWith([
      { token: 'token-1', product_id: product.id, action: 'confirm_sold' },
      { token: 'token-2', product_id: product.id, action: 'still_available' },
    ])
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'seller@example.com',
      subject: '¿Vendiste tu Rossignol Hero Elite?',
      html: expect.stringContaining('/p/vendi/token-1?alt=token-2'),
      text: expect.stringContaining('/p/disponible/token-2?alt=token-1'),
    }))
    expect(mocks.sendEmail.mock.calls[0][0].html).toContain('https://example.com/first.jpg')
    expect(mocks.sendEmail.mock.calls[0][0].html).not.toContain('Cuéntanos con un toque')
    expect(mocks.updateProduct).toHaveBeenCalledWith({
      sale_reminder_sent_at: expect.any(String),
    })
    expect(mocks.updateEq).toHaveBeenCalledWith('id', product.id)
  })

  it('uses an anonymous listing email exactly as the cron does', async () => {
    const result = await sendSaleReminderForProduct(serviceClient(), {
      ...product,
      users: null,
      anon_contact: ' anon@example.com ',
    })

    expect(result).toEqual(expect.objectContaining({ ok: true, recipient: 'anon@example.com' }))
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'anon@example.com' }))
  })

  it('does not advance the reminder clock when delivery fails', async () => {
    mocks.sendEmail.mockResolvedValue({ ok: false, error: 'provider unavailable' })

    const result = await sendSaleReminderForProduct(serviceClient(), product)

    expect(result).toEqual({
      ok: false,
      code: 'EMAIL_SEND_FAILED',
      error: 'provider unavailable',
    })
    expect(mocks.updateProduct).not.toHaveBeenCalled()
  })
})
