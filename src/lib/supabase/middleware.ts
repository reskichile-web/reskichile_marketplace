import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Forward the current pathname to server components — Next.js doesn't
  // expose pathname via headers() by default, so we set our own header.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: requestHeaders },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: requestHeaders },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Only call getUser() (network round-trip) on protected routes
  const pathname = request.nextUrl.pathname
  const isProtected =
    pathname.startsWith('/mis-productos') ||
    pathname.startsWith('/perfil') ||
    pathname.startsWith('/admin') ||
    pathname.endsWith('/editar')

  if (isProtected) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const redirectUrl = new URL('/auth/login', request.url)
      redirectUrl.searchParams.set(
        'redirect',
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
      )
      return NextResponse.redirect(redirectUrl)
    }
  } else {
    // Public routes: refresh session cookie locally, no network call
    await supabase.auth.getSession()
  }

  return response
}
