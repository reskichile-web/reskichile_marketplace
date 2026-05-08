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

export async function fetchImageAsFile(url: string, name = 'reski.jpg'): Promise<File | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return new File([blob], name, { type: blob.type || 'image/jpeg' })
  } catch {
    return null
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function whatsappShareUrl(text: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
}

export function facebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
}

export function twitterShareUrl(text: string, url: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
}

export function canNativeShare(data?: { files?: File[] }): boolean {
  if (typeof navigator === 'undefined' || !('share' in navigator)) return false
  if (data?.files && (navigator as Navigator & { canShare?: (d: ShareData) => boolean }).canShare) {
    return !!(navigator as Navigator & { canShare?: (d: ShareData) => boolean }).canShare!({ files: data.files })
  }
  return true
}
