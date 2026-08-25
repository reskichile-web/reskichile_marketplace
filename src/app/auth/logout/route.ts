import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    await supabase.auth.signOut()
  } catch {
    // Cookie cleanup below remains authoritative even if the token is expired
    // or Supabase is temporarily unreachable.
  }

  try {
    const cookieStore = await cookies()
    for (const cookie of cookieStore.getAll()) {
      if (cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')) {
        cookieStore.delete(cookie.name)
      }
    }
  } catch {
    // signOut normally clears these cookies; this is only a defensive fallback.
  }

  const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' }
  if (request.headers.get('accept')?.includes('application/json')) {
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders })
  }

  // A logout form is a POST. 303 forces the next navigation to be a GET;
  // 307 repeated the POST against `/` and caused intermittent error pages.
  const response = NextResponse.redirect(new URL('/', request.url), 303)
  response.headers.set('Cache-Control', noStoreHeaders['Cache-Control'])
  return response
}
