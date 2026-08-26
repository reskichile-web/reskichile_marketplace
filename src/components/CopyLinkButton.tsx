'use client'

import { useEffect, useState } from 'react'
import { copyToClipboard, productShareData } from '@/lib/share'
import type { ProductWithImages } from '@/lib/types'

interface Props {
  product: ProductWithImages
  className?: string
  bare?: boolean
}

// Standalone copy-link button. Sits next to ShareButton and copies the
// product URL with a tight, no-await call chain so the clipboard write
// always happens within the user-activation window (Safari/iOS-safe).
export default function CopyLinkButton({ product, className, bare = false }: Props) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!copied && !error) return
    const t = setTimeout(() => {
      setCopied(false)
      setError(false)
    }, 2200)
    return () => clearTimeout(t)
  }, [copied, error])

  async function handleClick() {
    const data = productShareData(product)
    const ok = await copyToClipboard(data.url)
    if (ok) setCopied(true)
    else setError(true)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={copied ? 'Link copiado' : 'Copiar link del producto'}
      title={copied ? 'Link copiado' : 'Copiar link del producto'}
      className={`pressable flex shrink-0 items-center justify-center transition-colors ${
        bare
          ? 'text-gray-400 hover:text-gray-600'
          : 'rounded border border-gray-300 bg-white text-brand-500 hover:bg-gray-50'
      } ${className || ''}`}
    >
      {copied ? (
        <svg className="h-5 w-5 text-brand-500" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : error ? (
        <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
        </svg>
      ) : (
        <svg className="h-5 w-5 text-current" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15V6a2 2 0 012-2h9" />
        </svg>
      )}
    </button>
  )
}
