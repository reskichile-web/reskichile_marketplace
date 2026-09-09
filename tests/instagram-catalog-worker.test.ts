import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/instagram/catalog-render', () => ({ renderCatalogJpeg: vi.fn() }))
vi.mock('@/lib/instagram/catalog-selection', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/instagram/catalog-selection')>()
  return { ...original, selectCatalogProducts: vi.fn(), readCatalogProducts: vi.fn() }
})
import { runCatalogWorker, type CatalogWorkerDependencies } from '@/lib/instagram/catalog-worker'
import type { CatalogBatch, CatalogProduct } from '@/lib/instagram/catalog-contracts'
import type { InstagramPublishingConfig } from '@/lib/instagram/publishing-config'

const config: InstagramPublishingConfig = { enabled: true, accessToken: 'test', userId: '123456789', apiVersion: 'v26.0', publishingQuota: 100, maxAttempts: 3 }
const at = '2026-09-11T23:00:00.000Z'
function product(n: number): CatalogProduct {
  return { id: `99000000-0000-4000-8000-${String(n).padStart(12, '0')}`, slug: `ski-${n}`, status: 'approved',
    created_at: at, product_type: 'esquis', brand: 'Atomic', model: `Ski ${n}`, price: 100000,
    condition: 'nuevo', region: 'RM', comuna: 'Santiago', attributes: {}, product_images: [{ url: `https://storage.test/${n}.jpg`, order: 0 }] }
}
function fixture(count = 18) {
  const products = Array.from({ length: count }, (_, i) => product(i + 1))
  const batch: CatalogBatch = { local_date: '2026-09-11', scheduled_for: at, prepare_at: '2026-09-11T22:00:00Z',
    status: 'pending', generated_at: null, generation_attempts: 0, slides: [], last_error: null, lock_token: 'lease' }
  const sent = new Set<string>()
  const events: string[] = []
  let sequence = 0
  const deps: CatalogWorkerDependencies = {
    claim: vi.fn(async () => batch), save: vi.fn(async (b, release) => { events.push(`save:${b.status}:${release}`) }),
    select: vi.fn(async () => products), read: vi.fn(async () => products),
    render: vi.fn(async (_, p) => { events.push(`render:${p}`); return Buffer.from(`jpeg${p}`) }),
    upload: vi.fn(async (_, date, p) => `https://storage.test/${date}/${p}.jpg`),
    now: vi.fn(() => new Date(at)), wait: vi.fn(async () => {}),
    meta: {
      getPublishingLimit: vi.fn(async () => 0), createStoryContainer: vi.fn(async () => `container-${++sequence}`),
      getContainerStatus: vi.fn(async (id: string) => ({ statusCode: sent.has(id) ? 'PUBLISHED' as const : 'FINISHED' as const, status: null })),
      publishContainer: vi.fn(async id => { events.push(`send:${id}`); sent.add(id); return `media-${id}` }),
    },
    record: vi.fn(async slide => { events.push(`record:${slide.position}`); return at }),
  }
  return { deps, batch, products, sent, events }
}

describe('Catalog automatic batch worker', () => {
  it('does not claim when publishing is disabled', async () => {
    const f = fixture()
    expect(await runCatalogWorker({ ...config, enabled: false }, f.deps)).toEqual({ state: 'disabled' })
    expect(f.deps.claim).not.toHaveBeenCalled()
  })
  it('does nothing when no due batch can be claimed', async () => {
    const f = fixture(); vi.mocked(f.deps.claim).mockResolvedValue(null)
    expect(await runCatalogWorker(config, f.deps)).toEqual({ state: 'idle' })
    expect(f.deps.select).not.toHaveBeenCalled()
  })
  it('generates three images an hour before, without touching Meta or rotation', async () => {
    const f = fixture(); vi.mocked(f.deps.now).mockReturnValue(new Date('2026-09-11T22:00:00Z'))
    expect(await runCatalogWorker(config, f.deps)).toMatchObject({ state: 'ready' })
    expect(f.batch.slides.map(s => s.products.length)).toEqual([0, 9, 9])
    expect(f.batch.generated_at).toBe('2026-09-11T22:00:00.000Z')
    expect(f.deps.meta.createStoryContainer).not.toHaveBeenCalled()
    expect(f.deps.record).not.toHaveBeenCalled()
  })
  it('publishes intro and two sheets in order, recording only the sheets', async () => {
    const f = fixture()
    expect(await runCatalogWorker(config, f.deps)).toMatchObject({ state: 'published' })
    expect(f.events.filter(x => x.startsWith('send:'))).toEqual(['send:container-1', 'send:container-2', 'send:container-3'])
    expect(f.events.filter(x => x.startsWith('record:'))).toEqual(['record:1', 'record:2'])
    expect(f.batch.slides.every(s => s.publishedAt)).toBe(true)
    for (const [i, event] of f.events.entries()) if (event.startsWith('send:')) expect(f.events[i - 1]).toBe('save:publishing:false')
  })
  it('falls back to intro + one sheet for a small catalog', async () => {
    const f = fixture(5)
    await runCatalogWorker(config, f.deps)
    expect(f.batch.slides.map(s => s.products.length)).toEqual([0, 5])
    expect(f.deps.meta.publishContainer).toHaveBeenCalledTimes(2)
  })
  it('never publishes the intro if the catalog is empty', async () => {
    const f = fixture(0)
    expect(await runCatalogWorker(config, f.deps)).toMatchObject({ state: 'skipped' })
    expect(f.deps.render).not.toHaveBeenCalled()
    expect(f.deps.meta.publishContainer).not.toHaveBeenCalled()
  })
  it('does not send anything if a product image fails to render', async () => {
    const f = fixture(); vi.mocked(f.deps.render).mockRejectedValueOnce(new Error('foto fallida'))
    expect(await runCatalogWorker(config, f.deps)).toMatchObject({ state: 'retry' })
    expect(f.batch.last_error).toContain('foto fallida')
    expect(f.batch.generated_at).toBeNull()
    expect(f.deps.meta.publishContainer).not.toHaveBeenCalled()
  })
  it('stops initial generation after four attempts', async () => {
    const f = fixture(); f.batch.generation_attempts = 4
    expect(await runCatalogWorker(config, f.deps)).toMatchObject({ state: 'failed' })
    expect(f.deps.render).not.toHaveBeenCalled()
  })
  it('checks quota for the whole batch before publishing an intro', async () => {
    const f = fixture(); vi.mocked(f.deps.meta.getPublishingLimit).mockResolvedValue(99)
    expect(await runCatalogWorker(config, f.deps)).toMatchObject({ state: 'retry' })
    expect(f.deps.meta.publishContainer).not.toHaveBeenCalled()
  })
  it('waits for all containers before sending any story', async () => {
    const f = fixture()
    vi.mocked(f.deps.meta.getContainerStatus).mockImplementation(async id => ({ statusCode: id === 'container-2' ? 'IN_PROGRESS' : 'FINISHED', status: null }))
    expect(await runCatalogWorker(config, f.deps)).toMatchObject({ state: 'retry' })
    expect(f.deps.meta.publishContainer).not.toHaveBeenCalled()
  })
  it('replaces a sold item without duplicating the other sheet and refreshes a price', async () => {
    const f = fixture(19)
    vi.mocked(f.deps.read).mockResolvedValue(f.products.slice(1).map(p => p.id === product(2).id ? { ...p, price: 50000 } : p))
    await runCatalogWorker(config, f.deps)
    const selected = f.batch.slides.flatMap(s => s.products)
    expect(selected).toHaveLength(18)
    expect(new Set(selected.map(p => p.id)).size).toBe(18)
    expect(selected.some(p => p.id === product(1).id)).toBe(false)
    expect(selected.find(p => p.id === product(2).id)?.price).toBe(50000)
    expect(f.deps.render).toHaveBeenCalledTimes(4)
  })
  it('persists the send intent and never retries an ambiguous POST', async () => {
    const f = fixture()
    vi.mocked(f.deps.meta.publishContainer).mockRejectedValueOnce(new Error('timeout'))
    await runCatalogWorker(config, f.deps)
    expect(f.batch.slides[0].attemptedAt).toBe(at)
    expect(f.batch.slides[0].containerId).toBe('container-1')
    await runCatalogWorker(config, f.deps)
    expect(f.deps.meta.publishContainer).toHaveBeenCalledTimes(1)
    expect(f.deps.meta.createStoryContainer).toHaveBeenCalledTimes(3)
  })
  it('recovers a successful POST with a lost response, without repeating the intro', async () => {
    const f = fixture()
    vi.mocked(f.deps.meta.publishContainer).mockImplementationOnce(async id => { f.sent.add(id); throw new Error('lost response') })
    await runCatalogWorker(config, f.deps)
    expect(await runCatalogWorker(config, f.deps)).toMatchObject({ state: 'published' })
    expect(f.deps.meta.publishContainer).toHaveBeenCalledTimes(3)
    expect(f.deps.record).toHaveBeenCalledTimes(2)
  })
  it('recovers failed history persistence without sending again', async () => {
    const f = fixture(); vi.mocked(f.deps.record).mockRejectedValueOnce(new Error('database unavailable'))
    await runCatalogWorker(config, f.deps)
    expect(f.batch.slides[0].publishedAt).toBe(at)
    expect(f.batch.slides[1].publishedAt).toBeNull()
    expect(await runCatalogWorker(config, f.deps)).toMatchObject({ state: 'published' })
    expect(f.deps.meta.publishContainer).toHaveBeenCalledTimes(3)
  })
  it('never sends an old ready batch after its window', async () => {
    const f = fixture()
    vi.mocked(f.deps.now).mockReturnValue(new Date('2026-09-11T22:00:00Z'))
    await runCatalogWorker(config, f.deps)
    vi.mocked(f.deps.now).mockReturnValue(new Date('2026-09-12T00:01:00Z'))
    expect(await runCatalogWorker(config, f.deps)).toMatchObject({ state: 'failed' })
    expect(f.deps.meta.publishContainer).not.toHaveBeenCalled()
  })
  it('can reconcile a late confirmation without publishing the remaining stale sheets', async () => {
    const f = fixture()
    vi.mocked(f.deps.meta.publishContainer).mockImplementationOnce(async id => { f.sent.add(id); throw new Error('lost response') })
    await runCatalogWorker(config, f.deps)
    vi.mocked(f.deps.now).mockReturnValue(new Date('2026-09-12T21:30:00Z'))
    expect(await runCatalogWorker(config, f.deps)).toMatchObject({ state: 'failed' })
    expect(f.batch.slides[0].publishedAt).not.toBeNull()
    expect(f.deps.meta.publishContainer).toHaveBeenCalledTimes(1)
  })
  it('does not publish if the lease cannot persist the generation checkpoint', async () => {
    const f = fixture(); vi.mocked(f.deps.save).mockRejectedValue(new Error('lease lost'))
    await expect(runCatalogWorker(config, f.deps)).rejects.toThrow('lease lost')
    expect(f.deps.meta.publishContainer).not.toHaveBeenCalled()
  })
})
