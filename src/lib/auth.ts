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

  if (!user) return { user: null, isAdmin: false }

  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return { user, isAdmin: profile?.is_admin ?? false }
})
