import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('Vercel catalog generation and publication coverage', () => {
  const { crons } = JSON.parse(readFileSync('vercel.json', 'utf8')) as { crons: { path: string; schedule: string }[] }
  const catalog = crons.filter(cron => cron.path.startsWith('/api/cron/instagram-catalog/'))
  it('covers preparation one hour before and publication in both Chile offsets', () => {
    const times = new Set(catalog.map(cron => cron.path.slice(-4)))
    for (const offset of [3, 4]) for (const minute of [18 * 60 + 30, 19 * 60, 19 * 60 + 30, 20 * 60]) {
      const utc = (minute + offset * 60) % 1440
      expect(times.has(`${String(Math.floor(utc / 60)).padStart(2, '0')}${String(utc % 60).padStart(2, '0')}`)).toBe(true)
    }
    expect(times.has('0100')).toBe(true)
  })
  it('uses distinct daily paths and fewer than 100 total jobs', () => {
    expect(catalog).toHaveLength(15)
    expect(crons.length).toBeLessThanOrEqual(100)
    expect(new Set(crons.map(c => c.path)).size).toBe(crons.length)
    for (const cron of catalog) expect(cron.schedule).toMatch(/^\d+ \d+ \* \* \*$/)
  })
})
