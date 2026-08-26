import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { publishEligibleInstagramStories } from '@/lib/instagram/publish-stories'
import { cleanupQueuedProductStories } from '@/lib/instagram/story-cleanup'
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
    let storyCleanup = { queued: 0, removed: 0, failed: 0 }
    try {
      storyCleanup = await cleanupQueuedProductStories()
    } catch {
      storyCleanup.failed = 1
      console.error('[instagram-cron] Story storage cleanup deferred')
    }
    const summary = await publishEligibleInstagramStories(config)
    return NextResponse.json({ ...summary, storyCleanup }, {
      headers: { 'Cache-Control': 'no-store, private' },
    })
  } catch {
    return NextResponse.json(
      { error: 'No se pudo procesar la cola de Instagram' },
      { status: 500, headers: { 'Cache-Control': 'no-store, private' } },
    )
  }
}
