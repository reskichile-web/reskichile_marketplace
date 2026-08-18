import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAppUrl } from '@/lib/env/server'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getAppUrl', () => {
  it('uses the verified canonical domain when Vercel has no legacy APP_URL', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', undefined)
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined)

    expect(getAppUrl().origin).toBe('https://www.reskichile.cl')
  })

  it('keeps an explicitly configured canonical origin', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', 'https://checkout.reskichile.cl')

    expect(getAppUrl().origin).toBe('https://checkout.reskichile.cl')
  })
})
