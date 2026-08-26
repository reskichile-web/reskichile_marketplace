import type { SupabaseClient } from '@supabase/supabase-js'

interface SignupProfile {
  id: string
  email: string | undefined
  name: string
  phone: string
}

/**
 * Confirm the profile fields after OTP verification.
 *
 * The auth trigger is the primary, atomic persistence path. This authenticated
 * update is a verified fallback and intentionally excludes `id`: authenticated
 * users only have UPDATE privileges on the self-service profile columns, so a
 * PostgREST upsert containing `id` is rejected even when the value is unchanged.
 */
export async function persistSignupProfile(
  supabase: SupabaseClient,
  profile: SignupProfile,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .update({
      email: profile.email,
      name: profile.name,
      phone: profile.phone,
    })
    .eq('id', profile.id)
    .select('phone')
    .single()

  return !error && data?.phone === profile.phone
}
