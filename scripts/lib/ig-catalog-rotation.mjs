const DAY_MS = 86_400_000
export const CATALOG_ROTATION_DAYS = 14

/** Read only confirmed catalog appearances, never individual Stories or exports.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string[]} productIds
 * @param {Date} now
 */
export async function fetchCatalogAppearances(client, productIds, now) {
  if (!Number.isFinite(now.getTime())) throw new Error('Fecha de rotación inválida.')
  const appearances = new Map()
  const ids = [...new Set(productIds)]
  for (let start = 0; start < ids.length; start += 500) {
    const { data, error } = await client.rpc('instagram_catalog_last_appearances', {
      p_product_ids: ids.slice(start, start + 500), p_until: now.toISOString(),
    })
    if (error || !Array.isArray(data)) {
      throw new Error('No se pudo leer el historial del catálogo. Aplica su migración antes de usar la rotación; no se asumirá un historial vacío.')
    }
    for (const row of data) {
      const timestamp = Date.parse(row.last_published_at)
      if (!Number.isFinite(timestamp) || timestamp > now.getTime()) throw new Error('Historial de catálogo inválido.')
      appearances.set(row.product_id, row.last_published_at)
    }
  }
  return appearances
}

/**
 * Partition the existing score ranking. Recently shown products are used only
 * after all eligible products, oldest appearance first; score breaks ties.
 * @template {{ id: string, status: string, ranking: { score: number } }} T
 * @param {T[]} ranked
 * @param {Map<string, string>} appearances
 * @param {Date} now
 */
export function rotateCatalogProducts(ranked, appearances, now) {
  if (!Number.isFinite(now.getTime())) throw new Error('Fecha de rotación inválida.')
  const active = ranked.filter(product => product.status === 'approved')
  if (new Set(active.map(product => product.id)).size !== active.length) throw new Error('Productos duplicados en la rotación.')
  const cutoff = now.getTime() - CATALOG_ROTATION_DAYS * DAY_MS
  const candidates = active.map(product => {
    if (!Number.isFinite(product.ranking.score)) throw new Error('Puntaje inválido para rotación.')
    const lastPublishedAt = appearances.get(product.id) ?? null
    const lastTime = lastPublishedAt === null ? null : Date.parse(lastPublishedAt)
    if (lastTime !== null && (!Number.isFinite(lastTime) || lastTime > now.getTime())) {
      throw new Error('Fecha de aparición inválida.')
    }
    return { ...product, rotation: {
      lastPublishedAt, eligible: lastTime === null || lastTime <= cutoff,
      reason: lastTime === null ? 'never-published' : lastTime <= cutoff ? 'cooldown-complete' : 'oldest-recent-fallback',
    } }
  })
  return candidates.sort((a, b) => {
    if (a.rotation.eligible !== b.rotation.eligible) return a.rotation.eligible ? -1 : 1
    if (!a.rotation.eligible) {
      const oldestFirst = Date.parse(a.rotation.lastPublishedAt) - Date.parse(b.rotation.lastPublishedAt)
      if (oldestFirst !== 0) return oldestFirst
    }
    // Inputs are already ranked with the formula's full deterministic tie-breaks.
    return b.ranking.score - a.ranking.score
  })
}
