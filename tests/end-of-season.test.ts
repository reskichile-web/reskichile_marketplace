import { afterEach, describe, expect, it, vi } from 'vitest'
import { SEASON_AUTOMATIONS_ENABLED, SALE_REMINDERS_ENABLED } from '@/lib/season'
import { getInstagramPublishingConfig } from '@/lib/instagram/publishing-config'
import { isInstagramCatalogEnabled } from '@/lib/instagram/catalog-config'
import { sendEmail } from '@/lib/email/send'
import { scheduleCaptureNext, moveCaptureSchedule, resetFailedCapturePublication } from '@/lib/instagram/scheduling'
import { GET as stories } from '@/app/api/cron/instagram-publish/route'
import { GET as catalog } from '@/app/api/cron/instagram-catalog/route'
import { GET as campaign } from '@/app/api/cron/sale-reminders/approved/[tick]/route'
import { GET as followup } from '@/app/api/cron/sale-reminders/approved-followup/[tick]/route'

const workers = vi.hoisted(() => ({ stories: vi.fn(), catalog: vi.fn(), cleanup: vi.fn(), database: vi.fn() }))
vi.mock('@/lib/instagram/publish-stories', () => ({ publishEligibleInstagramStories: workers.stories }))
vi.mock('@/lib/instagram/story-cleanup', () => ({ cleanupQueuedProductStories: workers.cleanup }))
vi.mock('@/lib/instagram/catalog-worker', () => ({ runCatalogWorker: workers.catalog }))
vi.mock('@/lib/supabase/server', () => ({ createServiceRoleClient: workers.database }))

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('End of season', () => {
  it('cannot be reactivated by stale production publishing settings', () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('INSTAGRAM_PUBLISHING_ENABLED', 'true')
    vi.stubEnv('INSTAGRAM_CATALOG_ENABLED', 'true')
    expect(SEASON_AUTOMATIONS_ENABLED).toBe(false)
    expect(SALE_REMINDERS_ENABLED).toBe(true)
    expect(getInstagramPublishingConfig().enabled).toBe(false)
    expect(isInstagramCatalogEnabled()).toBe(false)
  })

  it('stops old cron URLs before touching queues or publishing', async () => {
    vi.stubEnv('CRON_SECRET', 'c'.repeat(48))
    for (const handler of [stories, catalog, campaign, followup]) {
      const result = await handler(new Request('https://www.reskichile.cl/api/cron/test', {
        headers: { authorization: `Bearer ${'c'.repeat(48)}` },
      }))
      expect(result.status).toBe(200)
      expect(await result.json()).toMatchObject({ state: 'disabled', reason: 'season_ended' })
    }
    expect(workers.stories).not.toHaveBeenCalled()
    expect(workers.catalog).not.toHaveBeenCalled()
    expect(workers.cleanup).not.toHaveBeenCalled()
  })

  it('blocks new and retried story queue entries without touching the database', async () => {
    await expect(scheduleCaptureNext('capture')).rejects.toThrow('Fin de temporada')
    await expect(moveCaptureSchedule('capture', '2026-10-15', 1)).rejects.toThrow('Fin de temporada')
    await expect(resetFailedCapturePublication('capture')).rejects.toThrow('Fin de temporada')
    expect(workers.database).not.toHaveBeenCalled()
  })

  it('blocks automatic mail at the provider boundary and allows availability reminders', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-only')
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'email-id' }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    expect((await sendEmail({ to: 'test@example.com', subject: 'Chat', html: 'message' })).ok).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
    expect((await sendEmail({ category: 'sale-reminder', to: 'test@example.com', subject: 'Disponible', html: 'reminder' })).ok).toBe(true)
    expect(fetch).toHaveBeenCalledOnce()
  })
})
