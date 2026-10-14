import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ from: vi.fn(), sendEmail: vi.fn(), insert: vi.fn(), single: vi.fn(), update: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: mocks.from }) }))
vi.mock('@/lib/email/send', () => ({ sendEmail: mocks.sendEmail }))
import { POST } from '@/app/api/publish-anon/route'

function request(contact = '+56912345678') {
  const body = new FormData()
  for (const [key, value] of Object.entries({ product_type: 'esquis', brand: 'Rossignol', model: 'PMC 2000', condition: 'usado', price: '75000', region: 'Metropolitana', anon_contact: contact })) body.set(key, value)
  return new NextRequest('https://www.reskichile.cl/api/publish-anon', { method: 'POST', body })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.from.mockReturnValue({ insert: mocks.insert, update: mocks.update })
  mocks.insert.mockReturnValue({ select: () => ({ single: mocks.single }) })
  mocks.single.mockResolvedValue({ data: { id: 'product-id' }, error: null })
  mocks.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
  mocks.sendEmail.mockResolvedValue({ ok: true, id: 'email-id' })
})

describe('Anonymous publication notifications', () => {
  it('notifies Sebastián and the team after creating a publication without an account', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 'product-id' })
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'sebastian.derpsch@gmail.com',
      bcc: 'reskichile@gmail.com',
      subject: 'Nueva publicación pendiente · Rossignol PMC 2000',
      text: expect.stringContaining('https://www.reskichile.cl/admin/publicaciones'),
      idempotencyKey: 'publication-review/product-id',
    }))
    expect(mocks.single.mock.invocationCallOrder[0]).toBeLessThan(mocks.sendEmail.mock.invocationCallOrder[0])
  })

  it('preserves a successful publication if Resend rejects its notification', async () => {
    mocks.sendEmail.mockResolvedValue({ ok: false, error: 'Provider unavailable' })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 'product-id' })
  })

  it('does not notify for failed product creation', async () => {
    mocks.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } })
    expect((await POST(request())).status).toBe(500)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('does not notify for invalid submissions', async () => {
    expect((await POST(request('invalid'))).status).toBe(400)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
