import { NextResponse } from 'next/server'
import { parseAccountMarketingConsent } from '@/lib/marketing-consent'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' }

/**
 * Authoritative viewer identity for permission-sensitive client UI.
 *
 * Product pages are ISR-cached, so they cannot read cookies while rendering.
 * This endpoint resolves the request cookie on the server and deliberately
 * fails closed to an anonymous viewer.
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json(
        { userId: null, isAdmin: false, marketingConsent: null },
        { headers: NO_STORE },
      )
    }

    const { data: profile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    return NextResponse.json(
      {
        userId: user.id,
        isAdmin: profile?.is_admin === true,
        marketingConsent: parseAccountMarketingConsent(
          user.user_metadata?.marketing_consent,
        ),
      },
      { headers: NO_STORE },
    )
  } catch {
    return NextResponse.json(
      { userId: null, isAdmin: false, marketingConsent: null },
      { headers: NO_STORE },
    )
  }
}
