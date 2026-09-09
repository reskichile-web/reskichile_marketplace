import 'server-only'
import { createPublicServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { fetchProducts } from '../../../scripts/lib/ig-catalog.mjs'
import { fetchRecentProductViews, rankTrendingProducts } from '../../../scripts/lib/ig-catalog-ranking.mjs'
import { fetchCatalogAppearances, rotateCatalogProducts } from '../../../scripts/lib/ig-catalog-rotation.mjs'
import type { CatalogProduct } from './catalog-contracts'

export async function readCatalogProducts(): Promise<CatalogProduct[]> {
  return fetchProducts(createPublicServerClient())
}

export async function selectCatalogProducts(): Promise<CatalogProduct[]> {
  const products = await readCatalogProducts()
  const ids = products.map(product => product.id)
  const now = new Date()
  const client = createServiceRoleClient()
  const [views, history] = await Promise.all([
    fetchRecentProductViews(client, ids, now), fetchCatalogAppearances(client, ids, now),
  ])
  return rotateCatalogProducts(rankTrendingProducts(products, views.counts, now), history, now)
}

/** Compare only fields that are visible or choose the official image. */
export function catalogProductFingerprint(product: CatalogProduct): string {
  return JSON.stringify([product.id, product.status, product.slug, product.product_type,
    product.brand, product.model, product.price, product.condition, product.region, product.comuna,
    product.attributes, [...product.product_images].sort((a, b) => a.order - b.order)])
}
