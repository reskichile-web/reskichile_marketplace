import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Cached auth helper — deduplicates getUser() + is_admin query
 * within a single server request. Call this from any server component
 * instead of calling supabase.auth.getUser() directly.
 */
export const getAuthUser = cache(async () => {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { user: null, isAdmin: false, avatarUrl: null, userName: null }

  const { data: profile } = await supabase
    .from('users')
    .select('is_admin, avatar_url, name')
    .eq('id', user.id)
    .single()

  return {
    user,
    isAdmin: profile?.is_admin ?? false,
    avatarUrl: (profile?.avatar_url as string | null) ?? null,
    userName: (profile?.name as string | null) ?? null,
  }
})
