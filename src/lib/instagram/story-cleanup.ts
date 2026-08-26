import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/server'

const STORAGE_BUCKET = 'product-images'
const CLEANUP_TABLE = 'instagram_story_cleanup_queue'

interface StoryCleanupRow {
  product_id: string
  storage_paths: string[]
}

export interface StoryCleanupSummary {
  queued: number
  removed: number
  failed: number
}

interface CleanupOptions {
  service?: SupabaseClient
  productIds?: string[]
  limit?: number
}

function storagePathsFor(row: StoryCleanupRow): string[] {
  const prefix = `_instagram/products/${row.product_id}/`
  return [...new Set(row.storage_paths)]
    .filter((path) => path.startsWith(prefix) && !path.split('/').includes('..'))
}

export async function cleanupQueuedProductStories(
  options: CleanupOptions = {},
): Promise<StoryCleanupSummary> {
  const service = options.service || createServiceRoleClient()
  const productIds = [...new Set(options.productIds?.filter(Boolean) ?? [])]
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200))

  let query = service
    .from(CLEANUP_TABLE)
    .select('product_id, storage_paths')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (productIds.length > 0) query = query.in('product_id', productIds)

  const { data, error } = await query
  if (error) throw new Error('No pudimos leer la cola de limpieza de Stories')

  const rows = (data ?? []) as StoryCleanupRow[]
  const summary: StoryCleanupSummary = { queued: rows.length, removed: 0, failed: 0 }

  for (const row of rows) {
    const paths = storagePathsFor(row)
    const storageResult = paths.length > 0
      ? await service.storage.from(STORAGE_BUCKET).remove(paths)
      : { error: null }
    if (storageResult.error) {
      summary.failed += 1
      continue
    }

    const { error: deleteError } = await service
      .from(CLEANUP_TABLE)
      .delete()
      .eq('product_id', row.product_id)
    if (deleteError) {
      summary.failed += 1
      continue
    }
    summary.removed += 1
  }

  return summary
}
