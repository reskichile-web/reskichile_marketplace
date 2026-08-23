import 'server-only'

import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  createInstagramMetaClient,
  MetaApiError,
  type InstagramMetaClient,
} from './meta-client'
import type { InstagramPublishingConfig } from './publishing-config'

const CHILE_TIME_ZONE = 'America/Santiago'
const STALE_PUBLISHING_MS = 10 * 60_000
const DEFAULT_RUN_BUDGET_MS = 280_000
const DEFAULT_POLL_INTERVAL_MS = 60_000
const DEADLINE_RESERVE_MS = 12_000
const MAX_CONTAINER_CHECKS = 5
const STORY_SLOT_GRACE_MS = 59 * 60_000
const SCHEDULED_CLAIM_SCAN_LIMIT = 10

export interface PublishableStoryCapture {
  id: string
  product_id: string
  jpeg_public_url: string | null
  status: 'ready' | 'retry' | 'publishing'
  container_id: string | null
  media_id: string | null
  attempts: number
  approved_at: string
  updated_at: string
  scheduled_local_date: string | null
  scheduled_slot: number | null
  scheduled_for: string | null
  schedule_source: 'automatic' | 'manual' | null
}

export interface StoryPublishingRepository {
  recoverInterrupted(before: Date, now: Date): Promise<void>
  rescheduleExpired(now: Date): Promise<number>
  rescheduleCapture(captureId: string, now: Date): Promise<void>
  listEligible(now: Date, limit: number): Promise<PublishableStoryCapture[]>
  getPublishable(captureId: string): Promise<PublishableStoryCapture | null>
  claim(captureId: string): Promise<PublishableStoryCapture | null>
  isProductApproved(productId: string): Promise<boolean>
  saveContainer(captureId: string, containerId: string): Promise<boolean>
  markPublished(captureId: string, containerId: string, mediaId: string, now: Date): Promise<void>
  markRecoveredPublished(captureId: string, containerId: string, now: Date): Promise<void>
  releaseUnapproved(captureId: string): Promise<void>
  markPending(captureId: string, message: string): Promise<void>
  markFailure(
    captureId: string,
    attempts: number,
    maxAttempts: number,
    message: string,
    clearContainer: boolean,
  ): Promise<'retry' | 'failed'>
}

export interface InstagramPublishSummary {
  ok: true
  disabled: boolean
  quotaUsage: number | null
  candidates: number
  claimed: number
  published: number
  recoveredPublished: number
  retry: number
  failed: number
  skipped: number
}

interface PublishingDependencies {
  repository?: StoryPublishingRepository
  metaClient?: InstagramMetaClient
  fetchImpl?: typeof fetch
  now?: () => Date
  sleep?: (milliseconds: number) => Promise<void>
  runBudgetMs?: number
  pollIntervalMs?: number
}

interface PublishingSelection {
  mode: 'scheduled' | 'manual'
  captureId?: string
}

interface PendingContainer {
  capture: PublishableStoryCapture
  checks: number
  nextCheckAt: number
}

function sanitizedPublishingError(error: unknown): string {
  const value = error instanceof Error ? error.message : 'No pudimos publicar la Story'
  return value
    .replace(/authorization\s*:\s*bearer\s+[^\s,;]+/gi, 'Authorization: Bearer [redacted]')
    .replace(/((?:access_token|token)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/https?:\/\/[^\s]+/gi, '[url]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 500)
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  }
}

function timeZoneOffsetMilliseconds(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone)
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return representedAsUtc - date.getTime()
}

export function startOfTodayInChile(now: Date): Date {
  const local = zonedParts(now, CHILE_TIME_ZONE)
  const utcMidnightGuess = Date.UTC(local.year, local.month - 1, local.day)
  let result = utcMidnightGuess - timeZoneOffsetMilliseconds(
    new Date(utcMidnightGuess),
    CHILE_TIME_ZONE,
  )
  result = utcMidnightGuess - timeZoneOffsetMilliseconds(new Date(result), CHILE_TIME_ZONE)
  return new Date(result)
}

function sleepFor(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export function createSupabaseStoryPublishingRepository(): StoryPublishingRepository {
  const service = createServiceRoleClient()
  const captureFields = 'id, product_id, jpeg_public_url, status, container_id, media_id, attempts, approved_at, updated_at, scheduled_local_date, scheduled_slot, scheduled_for, schedule_source'

  async function requireNoError(error: { message?: string } | null, operation: string) {
    if (error) throw new Error(`No pudimos ${operation}`)
  }

  return {
    async recoverInterrupted(before, now) {
      const { error: completedError } = await service
        .from('instagram_story_captures')
        .update({ status: 'published', published_at: now.toISOString(), last_error: null })
        .not('media_id', 'is', null)
        .is('published_at', null)
      await requireNoError(completedError, 'recuperar publicaciones terminadas')

      const { error: staleError } = await service
        .from('instagram_story_captures')
        .update({ status: 'retry', last_error: 'Ejecución anterior interrumpida; se reutilizará el container' })
        .eq('status', 'publishing')
        .is('published_at', null)
        .lt('updated_at', before.toISOString())
      await requireNoError(staleError, 'recuperar publicaciones interrumpidas')
    },

    async rescheduleExpired(now) {
      const { data, error } = await service.rpc('instagram_reschedule_expired_captures', {
        p_now: now.toISOString(),
      })
      await requireNoError(error, 'reasignar ventanas vencidas')
      return Number(data || 0)
    },

    async rescheduleCapture(captureId, now) {
      const { error } = await service.rpc('instagram_reschedule_capture_next', {
        p_capture_id: captureId,
        p_now: now.toISOString(),
      })
      await requireNoError(error, 'reasignar una ventana vencida')
    },

    async listEligible(now, limit) {
      const earliest = new Date(now.getTime() - STORY_SLOT_GRACE_MS)
      const { data, error } = await service
        .from('instagram_story_captures')
        .select(`${captureFields}, products!inner(status)`)
        .in('status', ['ready', 'retry'])
        .not('scheduled_for', 'is', null)
        .gte('scheduled_for', earliest.toISOString())
        .lte('scheduled_for', now.toISOString())
        .is('published_at', null)
        .is('media_id', null)
        .eq('products.status', 'approved')
        .order('scheduled_for', { ascending: true })
        .limit(limit)
      await requireNoError(error, 'leer la cola de Instagram')
      return (data ?? []) as unknown as PublishableStoryCapture[]
    },

    async getPublishable(captureId) {
      const { data, error } = await service
        .from('instagram_story_captures')
        .select(`${captureFields}, products!inner(status)`)
        .eq('id', captureId)
        .in('status', ['ready', 'retry'])
        .is('published_at', null)
        .is('media_id', null)
        .eq('products.status', 'approved')
        .maybeSingle()
      await requireNoError(error, 'leer la captura de Instagram')
      return data as unknown as PublishableStoryCapture | null
    },

    async claim(captureId) {
      const { data, error } = await service
        .from('instagram_story_captures')
        .update({ status: 'publishing', last_error: null })
        .eq('id', captureId)
        .in('status', ['ready', 'retry'])
        .is('published_at', null)
        .is('media_id', null)
        .select(captureFields)
        .maybeSingle()
      await requireNoError(error, 'reclamar una captura')
      return data as PublishableStoryCapture | null
    },

    async isProductApproved(productId) {
      const { data, error } = await service
        .from('products')
        .select('status')
        .eq('id', productId)
        .maybeSingle()
      await requireNoError(error, 'validar el producto')
      return data?.status === 'approved'
    },

    async saveContainer(captureId, containerId) {
      const { data, error } = await service
        .from('instagram_story_captures')
        .update({ container_id: containerId })
        .eq('id', captureId)
        .eq('status', 'publishing')
        .is('container_id', null)
        .select('id')
        .maybeSingle()
      await requireNoError(error, 'guardar el container de Meta')
      return Boolean(data)
    },

    async markPublished(captureId, containerId, mediaId, now) {
      const { error } = await service
        .from('instagram_story_captures')
        .update({
          status: 'published',
          container_id: containerId,
          media_id: mediaId,
          published_at: now.toISOString(),
          last_error: null,
        })
        .eq('id', captureId)
        .eq('status', 'publishing')
        .is('published_at', null)
      await requireNoError(error, 'guardar la publicación de Instagram')
    },

    async markRecoveredPublished(captureId, containerId, now) {
      const { error } = await service
        .from('instagram_story_captures')
        .update({
          status: 'published',
          container_id: containerId,
          published_at: now.toISOString(),
          last_error: 'Publicación recuperada desde el estado PUBLISHED de Meta',
        })
        .eq('id', captureId)
        .eq('status', 'publishing')
        .is('published_at', null)
      await requireNoError(error, 'guardar la publicación recuperada')
    },

    async releaseUnapproved(captureId) {
      const { error } = await service
        .from('instagram_story_captures')
        .update({ status: 'ready', last_error: null })
        .eq('id', captureId)
        .eq('status', 'publishing')
      await requireNoError(error, 'liberar una captura no elegible')
    },

    async markPending(captureId, message) {
      const { error } = await service
        .from('instagram_story_captures')
        .update({ status: 'retry', last_error: message })
        .eq('id', captureId)
        .eq('status', 'publishing')
        .is('published_at', null)
      await requireNoError(error, 'guardar un container pendiente')
    },

    async markFailure(captureId, attempts, maxAttempts, message, clearContainer) {
      const nextAttempts = attempts + 1
      const status = nextAttempts >= maxAttempts ? 'failed' : 'retry'
      const { error } = await service
        .from('instagram_story_captures')
        .update({
          status,
          attempts: nextAttempts,
          last_error: message,
          ...(clearContainer ? { container_id: null } : {}),
        })
        .eq('id', captureId)
        .eq('status', 'publishing')
        .is('published_at', null)
      await requireNoError(error, 'guardar el fallo de publicación')
      return status
    },
  }
}

export async function publishEligibleInstagramStories(
  config: InstagramPublishingConfig,
  dependencies: PublishingDependencies = {},
): Promise<InstagramPublishSummary> {
  return publishInstagramStories(config, dependencies, { mode: 'scheduled' })
}

export async function publishInstagramStoryNow(
  config: InstagramPublishingConfig,
  captureId: string,
  dependencies: PublishingDependencies = {},
): Promise<InstagramPublishSummary> {
  return publishInstagramStories(config, dependencies, { mode: 'manual', captureId })
}

async function publishInstagramStories(
  config: InstagramPublishingConfig,
  dependencies: PublishingDependencies,
  selection: PublishingSelection,
): Promise<InstagramPublishSummary> {
  const summary: InstagramPublishSummary = {
    ok: true,
    disabled: !config.enabled,
    quotaUsage: null,
    candidates: 0,
    claimed: 0,
    published: 0,
    recoveredPublished: 0,
    retry: 0,
    failed: 0,
    skipped: 0,
  }
  if (!config.enabled) return summary

  const now = dependencies.now || (() => new Date())
  const sleep = dependencies.sleep || sleepFor
  const runBudgetMs = dependencies.runBudgetMs ?? DEFAULT_RUN_BUDGET_MS
  const pollIntervalMs = dependencies.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const repository = dependencies.repository || createSupabaseStoryPublishingRepository()
  const meta = dependencies.metaClient || createInstagramMetaClient(config, dependencies.fetchImpl)
  const startedAt = now().getTime()
  const deadline = startedAt + runBudgetMs

  const quotaUsage = await meta.getPublishingLimit()
  summary.quotaUsage = quotaUsage
  const availableQuota = Math.max(0, config.publishingQuota - quotaUsage)
  if (availableQuota === 0) return summary

  const recoveryNow = now()
  await repository.recoverInterrupted(
    new Date(recoveryNow.getTime() - STALE_PUBLISHING_MS),
    recoveryNow,
  )
  if (selection.mode === 'scheduled') await repository.rescheduleExpired(recoveryNow)
  const candidates = selection.mode === 'manual'
    ? [await repository.getPublishable(selection.captureId || '')].filter(
        (capture): capture is PublishableStoryCapture => Boolean(capture),
      )
    : await repository.listEligible(recoveryNow, SCHEDULED_CLAIM_SCAN_LIMIT)
  summary.candidates = candidates.length

  const pending: PendingContainer[] = []

  async function recordFailure(
    capture: PublishableStoryCapture,
    error: unknown,
    clearContainer: boolean,
  ) {
    const nextStatus = await repository.markFailure(
      capture.id,
      capture.attempts,
      config.maxAttempts,
      sanitizedPublishingError(error),
      clearContainer,
    )
    summary[nextStatus] += 1
  }

  async function advanceContainer(item: PendingContainer): Promise<'done' | 'pending'> {
    const capture = item.capture
    try {
      if (
        selection.mode === 'scheduled'
        && capture.scheduled_for
        && now().getTime() > new Date(capture.scheduled_for).getTime() + STORY_SLOT_GRACE_MS
      ) {
        await repository.rescheduleCapture(capture.id, now())
        summary.skipped += 1
        return 'done'
      }

      if (!(await repository.isProductApproved(capture.product_id))) {
        await repository.releaseUnapproved(capture.id)
        summary.skipped += 1
        return 'done'
      }

      if (!capture.jpeg_public_url) {
        await recordFailure(capture, new Error('La captura no tiene una URL pública'), false)
        return 'done'
      }

      if (!capture.container_id) {
        const containerId = await meta.createStoryContainer(capture.jpeg_public_url)
        const persisted = await repository.saveContainer(capture.id, containerId)
        if (!persisted) {
          summary.skipped += 1
          return 'done'
        }
        capture.container_id = containerId
      }

      const container = await meta.getContainerStatus(capture.container_id)
      item.checks += 1

      if (container.statusCode === 'IN_PROGRESS') return 'pending'

      if (container.statusCode === 'PUBLISHED') {
        await repository.markRecoveredPublished(capture.id, capture.container_id, now())
        summary.recoveredPublished += 1
        return 'done'
      }

      if (container.statusCode === 'EXPIRED' || container.statusCode === 'ERROR') {
        await recordFailure(
          capture,
          new Error(container.status || `Container ${container.statusCode}`),
          true,
        )
        return 'done'
      }

      if (!(await repository.isProductApproved(capture.product_id))) {
        await repository.releaseUnapproved(capture.id)
        summary.skipped += 1
        return 'done'
      }


      if (
        selection.mode === 'scheduled'
        && capture.scheduled_for
        && now().getTime() > new Date(capture.scheduled_for).getTime() + STORY_SLOT_GRACE_MS
      ) {
        await repository.rescheduleCapture(capture.id, now())
        summary.skipped += 1
        return 'done'
      }

      const mediaId = await meta.publishContainer(capture.container_id)
      await repository.markPublished(capture.id, capture.container_id, mediaId, now())
      summary.published += 1
      return 'done'
    } catch (error) {
      const clearContainer = error instanceof MetaApiError
        ? !error.uncertain && error.status !== null && error.status >= 400 && error.status < 500 && error.status !== 429
        : false
      await recordFailure(capture, error, clearContainer && !capture.container_id)
      return 'done'
    }
  }

  for (const candidate of candidates) {
    if (now().getTime() >= deadline - DEADLINE_RESERVE_MS) break
    const capture = await repository.claim(candidate.id)
    if (!capture) {
      summary.skipped += 1
      continue
    }
    summary.claimed += 1
    const item: PendingContainer = { capture, checks: 0, nextCheckAt: now().getTime() }
    const outcome = await advanceContainer(item)
    if (outcome === 'pending') {
      item.nextCheckAt = now().getTime() + pollIntervalMs
      pending.push(item)
    }
    // Each Hobby-safe tick publishes at most one Story. Scanning several due
    // rows only prevents concurrent invocations from colliding on the same
    // oldest capture; the first claim that succeeds owns this invocation.
    if (selection.mode === 'scheduled') break
  }

  while (pending.length > 0) {
    pending.sort((left, right) => left.nextCheckAt - right.nextCheckAt)
    const first = pending[0]
    if (first.checks >= MAX_CONTAINER_CHECKS) {
      pending.shift()
      await repository.markPending(first.capture.id, 'Meta continúa procesando el container')
      summary.retry += 1
      continue
    }
    if (first.nextCheckAt >= deadline - DEADLINE_RESERVE_MS) break

    const wait = Math.max(0, first.nextCheckAt - now().getTime())
    if (wait > 0) await sleep(wait)
    if (now().getTime() >= deadline - DEADLINE_RESERVE_MS) break

    pending.shift()
    const outcome = await advanceContainer(first)
    if (outcome === 'pending') {
      first.nextCheckAt = now().getTime() + pollIntervalMs
      pending.push(first)
    }
  }

  for (const item of pending) {
    await repository.markPending(item.capture.id, 'Container pendiente para la próxima ejecución')
    summary.retry += 1
  }

  return summary
}
