import type { createClient } from '@/lib/supabase/client'

type Supabase = ReturnType<typeof createClient>
type Router = { push: (href: string) => void; refresh: () => void }

const AUTH_REDIRECT_ORIGIN = 'https://reskichile.local'
const AUTH_REDIRECT_MAX_LENGTH = 4096

/**
 * Authentication redirects are user-controlled query parameters. Keep only
 * same-site paths so login, signup and email callbacks cannot become open
 * redirects while still preserving ad/query parameters and hashes.
 */
export function normalizeAuthRedirect(
  value: string | null | undefined,
  fallback = '/',
): string {
  if (!value || value.length > AUTH_REDIRECT_MAX_LENGTH || !value.startsWith('/')) {
    return fallback
  }

  try {
    const target = new URL(value, AUTH_REDIRECT_ORIGIN)
    if (target.origin !== AUTH_REDIRECT_ORIGIN) return fallback
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return fallback
  }
}

export function authRouteWithRedirect(
  route: string,
  redirect: string,
  extra: Record<string, string | null | undefined> = {},
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value)
  }
  params.set('redirect', normalizeAuthRedirect(redirect))
  return `${route}?${params.toString()}`
}

export function authCallbackUrl(origin: string, redirect: string): string {
  const callback = new URL('/auth/callback', origin)
  callback.searchParams.set('next', normalizeAuthRedirect(redirect))
  return callback.toString()
}

export function authRecoveryUrl(origin: string, redirect: string): string {
  const recovery = new URL('/auth/reset-password', origin)
  recovery.searchParams.set('redirect', normalizeAuthRedirect(redirect))
  return recovery.toString()
}

export function currentBrowserAuthRedirect(): string {
  if (typeof window === 'undefined') return '/'
  return normalizeAuthRedirect(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  )
}

/**
 * Redirect a freshly-authenticated user to /admin if their profile has
 * is_admin = true, else to the given fallback. Always calls router.refresh()
 * so the global Header re-renders with the new session.
 */
export async function redirectAfterAuth(
  supabase: Supabase,
  router: Router,
  fallback: string = '/',
) {
  const { data: { user } } = await supabase.auth.getUser()
  let target = normalizeAuthRedirect(fallback)
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    if (profile?.is_admin) target = '/admin'
  }
  router.push(target)
  router.refresh()
}
