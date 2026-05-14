import type { createClient } from '@/lib/supabase/client'

type Supabase = ReturnType<typeof createClient>
type Router = { push: (href: string) => void; refresh: () => void }

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
  let target = fallback
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
