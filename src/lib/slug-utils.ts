/**
 * Generate a URL-friendly slug from brand + model + short ID.
 * Example: "salomon-qst-106-3f1a7a1d"
 */
export function buildProductSlug(brand: string, model: string | null, id: string): string {
  const slug = (s: string) =>
    s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  const parts = [slug(brand)]
  if (model) parts.push(slug(model))
  parts.push(id.slice(0, 8))

  return parts.filter(Boolean).join('-')
}
