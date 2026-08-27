const MINIMUM_RECENT_PRODUCTS = 5

interface PublishedProduct {
  id: string
  created_at: string
}

/**
 * Only the five newest listings are highlighted. A label remains until five
 * newer products have displaced it, even when that takes longer than 3 days.
 */
export function getRecentlyPublishedProductIds(
  products: PublishedProduct[],
): Set<string> {
  const published = products
    .map(product => ({ ...product, timestamp: Date.parse(product.created_at) }))
    .filter(product => Number.isFinite(product.timestamp))
    .sort((left, right) => right.timestamp - left.timestamp || left.id.localeCompare(right.id))

  const ids = new Set(
    published
      .slice(0, MINIMUM_RECENT_PRODUCTS)
      .map(product => product.id),
  )

  return ids
}
