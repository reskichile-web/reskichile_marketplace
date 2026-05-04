/**
 * Generate a readable storage path for product images.
 * Format: {slug}/{index}.{ext}  e.g. salomon-qst-106-3f1a7a1d/1.jpg
 */
export function buildImagePath(slug: string, index: number, ext: string): string {
  return `${slug}/${index + 1}.${ext}`
}
