import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase/server', () => ({ createServiceRoleClient: vi.fn() }))
import { recordConfirmedCatalogSheet } from '@/lib/instagram/catalog-publications'
import type { MetaContainerStatusCode } from '@/lib/instagram/meta-client'

const productId = '99000000-0000-4000-8000-000000000001'
const receipt = { containerId: 'container-1', mediaId: 'media-1', productIds: [productId] }
const makeDeps = (status: MetaContainerStatusCode) => ({
  metaClient: { getContainerStatus: vi.fn(async () => ({ statusCode: status, status: null })) },
  repository: { rpc: vi.fn().mockResolvedValue({ data: '2026-09-10T20:00:00Z', error: null }) },
})

describe('Confirmed catalog publication history', () => {
  it.each(['FINISHED', 'IN_PROGRESS', 'ERROR', 'EXPIRED'] as const)('does not record %s as published', async status => {
    const deps = makeDeps(status)
    expect(await recordConfirmedCatalogSheet(receipt, deps)).toEqual({ recorded: false, publishedAt: null })
    expect(deps.repository.rpc).not.toHaveBeenCalled()
  })
  it('records only the confirmed sheet, not other sheets in a partial batch', async () => {
    const deps = makeDeps('PUBLISHED')
    expect(await recordConfirmedCatalogSheet(receipt, deps)).toMatchObject({ recorded: true })
    expect(deps.repository.rpc).toHaveBeenCalledWith('instagram_record_catalog_publication', {
      p_container_id: 'container-1', p_media_id: 'media-1', p_product_ids: [productId],
    })
    deps.metaClient.getContainerStatus.mockResolvedValueOnce({ statusCode: 'IN_PROGRESS', status: null })
    await recordConfirmedCatalogSheet({ containerId: 'container-2', mediaId: null, productIds: ['99000000-0000-4000-8000-000000000002'] }, deps)
    expect(deps.repository.rpc).toHaveBeenCalledTimes(1)
  })
  it('does not record a preview or empty intro', async () => {
    const deps = makeDeps('PUBLISHED')
    await expect(recordConfirmedCatalogSheet({ ...receipt, previewOnly: true }, deps)).rejects.toThrow('previsualización')
    await expect(recordConfirmedCatalogSheet({ ...receipt, productIds: [] }, deps)).rejects.toThrow('inválida')
    expect(deps.metaClient.getContainerStatus).not.toHaveBeenCalled()
    expect(deps.repository.rpc).not.toHaveBeenCalled()
  })
  it('does not fabricate confirmation when Meta fails', async () => {
    const deps = makeDeps('PUBLISHED')
    deps.metaClient.getContainerStatus.mockRejectedValueOnce(new Error('network'))
    await expect(recordConfirmedCatalogSheet(receipt, deps)).rejects.toThrow('network')
    expect(deps.repository.rpc).not.toHaveBeenCalled()
  })
  it('reports a persistence failure without publishing again', async () => {
    const deps = makeDeps('PUBLISHED')
    deps.repository.rpc.mockResolvedValueOnce({ data: null, error: { message: 'offline' } })
    await expect(recordConfirmedCatalogSheet(receipt, deps)).rejects.toThrow('sin volver a publicar')
  })
})
