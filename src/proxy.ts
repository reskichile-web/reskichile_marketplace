import { updateSession } from '@/lib/supabase/middleware'
import { ensureVisitorCookie } from '@/lib/visitor'
import { getAppUrl } from '@/lib/env/server'
import { canonicalPreviewNavigationRedirect } from '@/lib/commerce/checkout-origin'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  try {
    const canonical = canonicalPreviewNavigationRedirect(request, getAppUrl())
    if (canonical) return NextResponse.redirect(canonical, 307)
  } catch {
    // Invalid/missing canonical configuration must not create a redirect loop.
    // Checkout POST endpoints still fail closed through the Origin guard.
  }

  // Legacy IG links: /ski-rack-{anything} → render the /ski-rack view
  if (request.nextUrl.pathname.startsWith('/ski-rack-')) {
    const url = request.nextUrl.clone()
    url.pathname = '/ski-rack'
    return ensureVisitorCookie(request, NextResponse.rewrite(url))
  }

  // The analytics visitor id is minted here, on the document response, so the
  // pageview and product_view beacons of a first load share one identity.
  return ensureVisitorCookie(request, await updateSession(request))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
