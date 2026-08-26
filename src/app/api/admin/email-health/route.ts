import { promises as dns } from 'dns'
import { NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i
const CACHE_TTL_MS = 15 * 60 * 1000
const mxCache = new Map<string, { deliverable: boolean; expiresAt: number }>()

async function lookupMxDeliverable(domain: string, timeoutMs = 1200): Promise<boolean> {
  const cached = mxCache.get(domain)
  if (cached && cached.expiresAt > Date.now()) return cached.deliverable
  try {
    const lookup = dns.resolveMx(domain)
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    })
    const records = await Promise.race([lookup, timeout])
    const deliverable = Array.isArray(records) && records.length > 0
    mxCache.set(domain, { deliverable, expiresAt: Date.now() + CACHE_TTL_MS })
    return deliverable
  } catch {
    mxCache.set(domain, { deliverable: false, expiresAt: Date.now() + CACHE_TTL_MS })
    return false
  }
}

export async function GET(request: Request) {
  try {
    await requireAdmin()
    const domains = [...new Set(
      (new URL(request.url).searchParams.get('domains') || '')
        .split(',')
        .map(domain => domain.trim().toLowerCase())
        .filter(domain => DOMAIN_PATTERN.test(domain))
        .slice(0, 50),
    )]
    const entries = await Promise.all(domains.map(async domain => [
      domain,
      await lookupMxDeliverable(domain),
    ] as const))
    return NextResponse.json(
      { domains: Object.fromEntries(entries) },
      { headers: { 'Cache-Control': 'private, max-age=900' } },
    )
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json(
      { error: known.message, code: known.code },
      { status: known.status, headers: { 'Cache-Control': 'no-store, private' } },
    )
  }
}
