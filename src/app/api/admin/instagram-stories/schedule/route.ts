import { NextResponse } from 'next/server'
import {
  AdminRequestError,
  adminErrorResponse,
  assertSameOrigin,
  readSmallJson,
  requireAdmin,
} from '@/lib/admin-security'
import {
  moveCaptureSchedule,
  resetFailedCapturePublication,
  scheduleCaptureNext,
  unscheduleCapture,
} from '@/lib/instagram/scheduling'
import { isInstagramStorySlotForDate } from '@/lib/instagram/schedule-rules'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    await requireAdmin()
    const body = await readSmallJson(request)
    const captureId = typeof body.captureId === 'string' ? body.captureId : ''
    const action = typeof body.action === 'string' ? body.action : ''
    if (!UUID_RE.test(captureId)) {
      throw new AdminRequestError('Captura inválida', 422, 'INVALID_CAPTURE_ID')
    }

    if (action === 'next') {
      const schedule = await scheduleCaptureNext(captureId, 'manual')
      return NextResponse.json({ ok: true, schedule }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (action === 'unschedule') {
      await unscheduleCapture(captureId)
      return NextResponse.json({ ok: true, schedule: null }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (action === 'retry-publishing') {
      await resetFailedCapturePublication(captureId)
      return NextResponse.json({ ok: true, schedule: null }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (action === 'move') {
      const localDate = typeof body.localDate === 'string' ? body.localDate : ''
      const slot = Number(body.slot)
      if (!DATE_RE.test(localDate) || !isInstagramStorySlotForDate(localDate, slot)) {
        throw new AdminRequestError('Cupo inválido', 422, 'INVALID_STORY_SLOT')
      }
      const schedule = await moveCaptureSchedule(captureId, localDate, slot)
      return NextResponse.json({ ok: true, schedule }, { headers: { 'Cache-Control': 'no-store' } })
    }

    throw new AdminRequestError('Acción inválida', 422, 'INVALID_SCHEDULE_ACTION')
  } catch (error) {
    const known = adminErrorResponse(error)
    const fallback = error instanceof Error ? error.message : known.message
    return NextResponse.json(
      { error: known.status === 500 ? fallback : known.message, code: known.code },
      { status: known.status, headers: { 'Cache-Control': 'no-store, private' } },
    )
  }
}
