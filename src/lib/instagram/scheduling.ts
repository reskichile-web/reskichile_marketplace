import 'server-only'

import { createServiceRoleClient } from '@/lib/supabase/server'

export interface InstagramCaptureSchedule {
  scheduledLocalDate: string
  scheduledSlot: number
  scheduledFor: string
  scheduleSource: 'automatic' | 'manual'
}

interface ScheduleRow {
  scheduled_local_date: string
  scheduled_slot: number
  scheduled_for: string
  schedule_source: 'automatic' | 'manual'
}

function fromRow(row: ScheduleRow): InstagramCaptureSchedule {
  return {
    scheduledLocalDate: row.scheduled_local_date,
    scheduledSlot: row.scheduled_slot,
    scheduledFor: row.scheduled_for,
    scheduleSource: row.schedule_source,
  }
}

export async function scheduleCaptureNext(
  captureId: string,
  source: 'automatic' | 'manual' = 'automatic',
): Promise<InstagramCaptureSchedule> {
  const service = createServiceRoleClient()
  const { data, error } = await service.rpc('instagram_schedule_capture_next', {
    p_capture_id: captureId,
    p_start_date: null,
    p_source: source,
  })
  const row = (Array.isArray(data) ? data[0] : data) as ScheduleRow | null
  if (error || !row) throw new Error('No pudimos asignar un cupo de Instagram')
  return fromRow(row)
}

export async function moveCaptureSchedule(
  captureId: string,
  localDate: string,
  slot: number,
): Promise<InstagramCaptureSchedule> {
  const service = createServiceRoleClient()
  const { data, error } = await service.rpc('instagram_move_capture_schedule', {
    p_capture_id: captureId,
    p_local_date: localDate,
    p_slot: slot,
  })
  const row = (Array.isArray(data) ? data[0] : data) as ScheduleRow | null
  if (error || !row) {
    if (error?.message?.includes('STORY_SLOT_OCCUPIED')) throw new Error('Ese cupo ya está ocupado')
    if (error?.message?.includes('STORY_SLOT_IN_PAST')) throw new Error('Ese cupo ya pasó')
    throw new Error('No pudimos mover la Story')
  }
  return fromRow(row)
}

export async function unscheduleCapture(captureId: string): Promise<void> {
  const service = createServiceRoleClient()
  const { error } = await service.rpc('instagram_unschedule_capture', {
    p_capture_id: captureId,
  })
  if (error) throw new Error('No pudimos sacar la Story del calendario')
}

export async function resetFailedCapturePublication(captureId: string): Promise<void> {
  const service = createServiceRoleClient()
  const { error } = await service.rpc('instagram_reset_failed_story_publication', {
    p_capture_id: captureId,
  })
  if (error) throw new Error('No pudimos reactivar la publicación de la Story')
}
