import { PRODUCT_TYPES } from '@/lib/constants'
import type { ProductWithImages } from '@/lib/types'

export interface ProductShareData {
  url: string
  title: string
  text: string
  caption: string
  imageUrl?: string
}

const PUBLIC_ORIGIN = 'https://reskichile.cl'

export function productShareData(product: ProductWithImages): ProductShareData {
  const title = [product.brand, product.model].filter(Boolean).join(' ') || 'Producto'
  const origin = typeof window !== 'undefined' ? window.location.origin : PUBLIC_ORIGIN
  const slugOrId = (product as unknown as { slug?: string | null }).slug || product.id
  const url = `${origin}/producto/${slugOrId}`
  const price = `$${product.price.toLocaleString('es-CL')}`
  const typeLabel = PRODUCT_TYPES[product.product_type] || product.product_type

  const text = `${title} • ${price}`
  const caption =
    `${title} — ${typeLabel}\n` +
    `${price}\n\n` +
    `Encuéntralo en ReskiChile 👇\n${url}\n\n` +
    `#reskichile #ski #snowboard`

  const imageUrl = product.product_images?.slice().sort((a, b) => a.order - b.order)[0]?.url

  return { url, title, text, caption, imageUrl }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  // Modern API — only works in secure contexts (HTTPS / localhost) and
  // requires the call to happen inside a user-gesture chain.
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to legacy fallback
  }
  // Legacy fallback for older browsers / non-secure contexts.
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    ta.style.top = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function whatsappShareUrl(text: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
}

export function canNativeShare(data?: { files?: File[] }): boolean {
  if (typeof navigator === 'undefined' || !('share' in navigator)) return false
  if (data?.files && (navigator as Navigator & { canShare?: (d: ShareData) => boolean }).canShare) {
    return !!(navigator as Navigator & { canShare?: (d: ShareData) => boolean }).canShare!({
      files: data.files,
    })
  }
  return true
}
