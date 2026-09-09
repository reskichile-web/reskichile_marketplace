import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createInstagramMetaClient, type InstagramMetaClient } from './meta-client'
import { getInstagramPublishingConfig } from './publishing-config'

interface CatalogSheetReceipt {
  containerId: string
  mediaId: string | null
  productIds: string[]
  previewOnly?: boolean
}

/** Called per product sheet by the future catalog publisher, never by rendering.
 * Partial batches record only sheets that Meta actually published.
 */
export async function recordConfirmedCatalogSheet(
  receipt: CatalogSheetReceipt,
  dependencies: {
    metaClient?: Pick<InstagramMetaClient, 'getContainerStatus'>
    repository?: Pick<ReturnType<typeof createServiceRoleClient>, 'rpc'>
  } = {},
) {
  if (receipt.previewOnly) throw new Error('Una previsualización no registra publicaciones')
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!receipt.containerId.trim() || receipt.productIds.length < 1 || receipt.productIds.length > 9
    || new Set(receipt.productIds).size !== receipt.productIds.length
    || receipt.productIds.some(id => !uuid.test(id))) throw new Error('Lámina de catálogo inválida')
  const meta = dependencies.metaClient || createInstagramMetaClient(getInstagramPublishingConfig())
  const status = await meta.getContainerStatus(receipt.containerId)
  if (status.statusCode !== 'PUBLISHED') return { recorded: false as const, publishedAt: null }

  const repository = dependencies.repository || createServiceRoleClient()
  const { data, error } = await repository.rpc('instagram_record_catalog_publication', {
    p_container_id: receipt.containerId, p_media_id: receipt.mediaId, p_product_ids: receipt.productIds,
  })
  if (error || typeof data !== 'string' || !Number.isFinite(Date.parse(data))) {
    throw new Error('Meta publicó la lámina, pero falta guardar su historial; reintentar la confirmación sin volver a publicar')
  }
  return { recorded: true as const, publishedAt: data }
}
