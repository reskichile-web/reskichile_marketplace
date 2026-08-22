import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { publishEligibleInstagramStories } from '@/lib/instagram/publish-stories'
import {
  getInstagramCronSecret,
  getInstagramPublishingConfig,
} from '@/lib/instagram/publishing-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function authorized(request: Request, secret: string): boolean {
  const actual = Buffer.from(request.headers.get('authorization') || '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function GET(request: Request) {
  try {
    const secret = getInstagramCronSecret()
    if (!authorized(request, secret)) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const config = getInstagramPublishingConfig()
    const summary = await publishEligibleInstagramStories(config)
    return NextResponse.json(summary, {
      headers: { 'Cache-Control': 'no-store, private' },
    })
  } catch {
    return NextResponse.json(
      { error: 'No se pudo procesar la cola de Instagram' },
      { status: 500, headers: { 'Cache-Control': 'no-store, private' } },
    )
  }
}
