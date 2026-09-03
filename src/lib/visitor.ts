import { randomUUID } from 'crypto'
import type { NextResponse } from 'next/server'

export const VISITOR_COOKIE = 'rv_id'
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isVisitorId(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/**
 * Anonymous visitor id straight off the request cookie header. Works for both
 * NextRequest and the plain Request handed to route handlers, so every
 * server-side event insert can stamp the same id the browser beacons carry.
 */
export function readVisitorId(request: Request): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null

  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    if (part.slice(0, separator).trim() !== VISITOR_COOKIE) continue
    const value = decodeURIComponent(part.slice(separator + 1).trim())
    return isVisitorId(value) ? value : null
  }
  return null
}

export function newVisitorId(): string {
  return randomUUID()
}

export function visitorCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: VISITOR_COOKIE_MAX_AGE,
    path: '/',
  }
}

/**
 * Mints the visitor cookie on the document response, before any analytics
 * beacon runs. /api/track used to do this per request: on a first load
 * `pageview` and `product_view` fly out together, both arrive without the
 * cookie, and each one minted a different id — inflating unique visitors and
 * breaking per-visitor depth. Issuing it once here makes the id stable.
 */
export function ensureVisitorCookie(request: Request, response: NextResponse): NextResponse {
  if (readVisitorId(request)) return response
  response.cookies.set(VISITOR_COOKIE, newVisitorId(), visitorCookieOptions())
  return response
}
