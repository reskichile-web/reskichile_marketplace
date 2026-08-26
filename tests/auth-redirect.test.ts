import { describe, expect, it, vi } from 'vitest'
import {
  authCallbackUrl,
  authRecoveryUrl,
  authRouteWithRedirect,
  currentBrowserAuthRedirect,
  currentBrowserPostAuthRedirect,
  normalizeAuthRedirect,
  redirectAfterAuth,
} from '@/lib/auth-redirect'

describe('auth redirect continuity', () => {
  const productReturn = '/producto/k2?utm_source=meta&utm_campaign=test_meta&fbclid=click-1&test_event_code=TEST67013#fotos'

  it('preserves the complete internal product destination', () => {
    expect(normalizeAuthRedirect(productReturn)).toBe(productReturn)

    const login = authRouteWithRedirect('/auth/login', productReturn)
    const parsed = new URL(login, 'https://www.reskichile.cl')
    expect(parsed.pathname).toBe('/auth/login')
    expect(parsed.searchParams.get('redirect')).toBe(productReturn)
  })

  it('carries the destination through registration and the email callback', () => {
    const register = authRouteWithRedirect('/auth/registro', productReturn, {
      email: 'buyer@example.com',
    })
    const registerUrl = new URL(register, 'https://www.reskichile.cl')
    expect(registerUrl.searchParams.get('email')).toBe('buyer@example.com')
    expect(registerUrl.searchParams.get('redirect')).toBe(productReturn)

    const callback = new URL(authCallbackUrl('https://www.reskichile.cl', productReturn))
    expect(callback.pathname).toBe('/auth/callback')
    expect(callback.searchParams.get('next')).toBe(productReturn)

    const recovery = new URL(authRecoveryUrl('https://www.reskichile.cl', productReturn))
    expect(recovery.pathname).toBe('/auth/reset-password')
    expect(recovery.searchParams.get('redirect')).toBe(productReturn)
  })

  it('rejects external, protocol-relative and malformed destinations', () => {
    expect(normalizeAuthRedirect('https://evil.example/phish')).toBe('/')
    expect(normalizeAuthRedirect('//evil.example/phish')).toBe('/')
    expect(normalizeAuthRedirect('/\\evil.example/phish')).toBe('/')
    expect(normalizeAuthRedirect('javascript:alert(1)')).toBe('/')
  })

  it('reads the full current browser path without dropping ad parameters', () => {
    vi.stubGlobal('window', {
      location: {
        pathname: '/producto/k2',
        search: '?utm_source=meta&fbclid=click-1',
        hash: '#fotos',
      },
    })

    expect(currentBrowserAuthRedirect()).toBe('/producto/k2?utm_source=meta&fbclid=click-1#fotos')
    vi.unstubAllGlobals()
  })

  it('keeps the original destination in header links inside the auth flow', () => {
    const login = authRouteWithRedirect('/auth/login', productReturn)
    const loginUrl = new URL(login, 'https://www.reskichile.cl')
    vi.stubGlobal('window', {
      location: {
        pathname: loginUrl.pathname,
        search: loginUrl.search,
        hash: '',
      },
    })

    expect(currentBrowserPostAuthRedirect()).toBe(productReturn)
    vi.unstubAllGlobals()
  })

  it('returns a regular buyer to the preserved product destination', async () => {
    const single = vi.fn().mockResolvedValue({ data: { is_admin: false } })
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'buyer-1' } } }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single })),
        })),
      })),
    }
    const router = { push: vi.fn(), refresh: vi.fn() }

    await redirectAfterAuth(
      supabase as never,
      router,
      productReturn,
    )

    expect(router.push).toHaveBeenCalledWith(productReturn)
    expect(router.refresh).toHaveBeenCalledOnce()
  })

  it('never follows an external post-auth destination', async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    }
    const router = { push: vi.fn(), refresh: vi.fn() }

    await redirectAfterAuth(
      supabase as never,
      router,
      'https://evil.example/phish',
    )

    expect(router.push).toHaveBeenCalledWith('/')
  })
})
