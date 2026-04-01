/**
 * Generate a clean, sortable storage path for product images.
 * Format: {userId}/{productId}/{brand}_{model}_{index}.{ext}
 *
 * - Slugifies brand and model (lowercase, no special chars)
 * - Adds a short timestamp suffix to avoid collisions on re-upload
 */
export function buildImagePath(
  userId: string,
  productId: string,
  brand: string,
  model: string | null,
  index: number,
  ext: string
): string {
  const slug = (s: string) =>
    s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  const brandSlug = slug(brand) || 'sin-marca'
  const modelSlug = model ? slug(model) : ''
  const name = modelSlug
    ? `${brandSlug}_${modelSlug}_${index}`
    : `${brandSlug}_${index}`

  // Short timestamp suffix (last 6 digits) to avoid collisions
  const ts = String(Date.now()).slice(-6)

  return `${userId}/${productId}/${name}_${ts}.${ext}`
}
