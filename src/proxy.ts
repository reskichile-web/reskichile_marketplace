import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Legacy IG links: /ski-rack-{anything} → render the /ski-rack view
  if (request.nextUrl.pathname.startsWith('/ski-rack-')) {
    const url = request.nextUrl.clone()
    url.pathname = '/ski-rack'
    return NextResponse.rewrite(url)
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
