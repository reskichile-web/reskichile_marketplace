import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Exercise the active-season contract; shutdown has separate coverage.
vi.mock('@/lib/season', () => ({ SEASON_AUTOMATIONS_ENABLED: true, SALE_REMINDERS_ENABLED: true }))
import { readFileSync } from 'node:fs'
const mocks = vi.hoisted(() => ({ worker: vi.fn() }))
vi.mock('@/lib/instagram/catalog-worker', () => ({ runCatalogWorker: mocks.worker }))
import { GET } from '@/app/api/cron/instagram-catalog/route'

const secret = 'c'.repeat(48)
const request = (auth = `Bearer ${secret}`) => new Request('https://www.reskichile.cl/api/cron/instagram-catalog', { headers: { authorization: auth } })
describe('Catalog cron authorization and activation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', secret)
    vi.stubEnv('INSTAGRAM_CATALOG_ENABLED', 'true')
    vi.stubEnv('INSTAGRAM_PUBLISHING_ENABLED', 'false')
    vi.stubEnv('VERCEL_ENV', 'production')
    mocks.worker.mockResolvedValue({ state: 'ready' })
  })
  afterEach(() => vi.unstubAllEnvs())
  it('rejects unauthorized calls before doing any work', async () => {
    expect((await GET(request('Bearer wrong'))).status).toBe(401)
    expect(mocks.worker).not.toHaveBeenCalled()
  })
  it('runs the worker for an authorized production cron', async () => {
    expect(await (await GET(request())).json()).toEqual({ state: 'ready' })
    expect(mocks.worker).toHaveBeenCalledOnce()
  })
  it.each(['preview', 'development'])('cannot publish from a %s deployment', async env => {
    vi.stubEnv('VERCEL_ENV', env)
    expect(await (await GET(request())).json()).toEqual({ state: 'disabled' })
    expect(mocks.worker).not.toHaveBeenCalled()
  })
  it('supports an explicit emergency off switch independently of individual stories', async () => {
    vi.stubEnv('INSTAGRAM_CATALOG_ENABLED', 'false')
    expect(await (await GET(request())).json()).toEqual({ state: 'disabled' })
    expect(mocks.worker).not.toHaveBeenCalled()
  })
  it('enables the approved production rollout without requiring a new dashboard variable', async () => {
    vi.stubEnv('INSTAGRAM_CATALOG_ENABLED', '')
    expect(await (await GET(request())).json()).toEqual({ state: 'ready' })
    expect(mocks.worker).toHaveBeenCalledOnce()
  })
  it('does not implicitly enable local scripts', async () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('INSTAGRAM_CATALOG_ENABLED', '')
    expect(await (await GET(request())).json()).toEqual({ state: 'disabled' })
    expect(mocks.worker).not.toHaveBeenCalled()
  })
  it('fails closed without a strong cron secret', async () => {
    vi.stubEnv('CRON_SECRET', 'short')
    expect((await GET(request())).status).toBe(500)
    expect(mocks.worker).not.toHaveBeenCalled()
  })
})

describe('Off-season catalog scheduling', () => {
  it('removes every catalog cron from deployment', () => {
    const { crons } = JSON.parse(readFileSync('vercel.json', 'utf8'))
    expect(crons.some((cron: { path: string }) => cron.path.includes('instagram'))).toBe(false)
  })
})
