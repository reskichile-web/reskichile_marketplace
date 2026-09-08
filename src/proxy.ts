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

  // Legacy IG links: /ski-rack-{anything} → render the /ski-rack view.
  if (request.nextUrl.pathname.startsWith('/ski-rack-')) {
    const url = request.nextUrl.clone()
    url.pathname = '/ski-rack'
    return ensureVisitorCookie(request, NextResponse.rewrite(url))
  }

  // Mint the anonymous analytics id on the document response. First-load
  // pageview/product_view/contact beacons can then share one stable identity.
  return ensureVisitorCookie(request, await updateSession(request))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
