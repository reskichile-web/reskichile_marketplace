import { NextResponse } from 'next/server'
import {
  AdminRequestError,
  adminErrorResponse,
  assertSameOrigin,
  consumeAdminRateLimit,
  readSmallJson,
  requireAdmin,
} from '@/lib/admin-security'
import { publishInstagramStoryNow } from '@/lib/instagram/publish-stories'
import { unscheduleCapture } from '@/lib/instagram/scheduling'
import {
  getInstagramCronSecret,
  getInstagramPublishingConfig,
} from '@/lib/instagram/publishing-config'

export const runtime = 'nodejs'
export const maxDuration = 300

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CONFIRMATION = 'PUBLICAR_EN_INSTAGRAM'

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin()
    const body = await readSmallJson(request)
    const captureId = typeof body.captureId === 'string' ? body.captureId : ''
    if (!UUID_RE.test(captureId)) {
      throw new AdminRequestError('Captura inválida', 422, 'INVALID_CAPTURE_ID')
    }
    if (body.confirmation !== CONFIRMATION) {
      throw new AdminRequestError(
        'Debes confirmar la publicación directa',
        422,
        'CONFIRMATION_REQUIRED',
      )
    }

    const config = getInstagramPublishingConfig()
    if (!config.enabled) {
      throw new AdminRequestError(
        'La publicación de Instagram está desactivada',
        409,
        'INSTAGRAM_PUBLISHING_DISABLED',
      )
    }
    await consumeAdminRateLimit(
      admin.id,
      'instagram-publish-now',
      getInstagramCronSecret(),
      3,
      60,
    )

    // A direct publication must release any future calendar slot first. If
    // Meta fails, the prepared Story remains visible as unscheduled work.
    await unscheduleCapture(captureId)
    const summary = await publishInstagramStoryNow(config, captureId)
    if (summary.published + summary.recoveredPublished !== 1) {
      throw new AdminRequestError(
        'La Story no quedó publicada; revisa su estado antes de reintentar',
        409,
        'STORY_NOT_PUBLISHED',
      )
    }
    return NextResponse.json({ ok: true, summary }, {
      headers: { 'Cache-Control': 'no-store, private' },
    })
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json(
      { error: known.message, code: known.code },
      { status: known.status, headers: { 'Cache-Control': 'no-store, private' } },
    )
  }
}
