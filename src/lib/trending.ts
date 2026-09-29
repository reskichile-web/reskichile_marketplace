import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

/** Persisted at publication time; never rerank while serving a feed or page. */
export async function fetchTrendingProductIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('trending_products')
    .select('product_id')
    .order('position', { ascending: true })
    .limit(40)

  if (error) throw new Error(`trending_query_failed:${error.code || 'database_error'}`)
  return (data ?? []).map(row => row.product_id as string)
}
