import { revalidatePath } from 'next/cache'

/**
 * Purge the ISR cache for a product so edits/approvals/sales show on the public
 * page immediately instead of waiting for the revalidate window. Revalidates
 * both the slug and id URLs (either may be cached) plus the home (recent grid).
 * Safe to call only from a server request context (route handler / server action).
 */
export function revalidateProduct(opts: { id?: string | null; slug?: string | null }) {
  if (opts.slug) revalidatePath(`/producto/${opts.slug}`)
  if (opts.id) revalidatePath(`/producto/${opts.id}`)
  revalidatePath('/')
}
