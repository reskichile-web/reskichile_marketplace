'use client'

import { useEffect, useState } from 'react'
import { generateStoryCard } from '@/lib/story-card'
import { canNativeShare, copyToClipboard, productShareData } from '@/lib/share'
import type { ProductWithImages } from '@/lib/types'

interface Props {
  product: ProductWithImages
  className?: string
}

type Toast = { kind: 'ok' | 'err'; text: string } | null

export default function InstagramStoryButton({ product, className }: Props) {
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<Toast>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  async function handleShare() {
    if (busy) return
    setBusy(true)
    try {
      const data = productShareData(product)
      const file = await generateStoryCard(product)

      // Mobile-first: Web Share API. The OS sheet lists Instagram → user
      // picks "Stories" or "Feed" inside IG once it opens.
      if (canNativeShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: data.title,
            text: data.caption,
          } as ShareData)
          setBusy(false)
          return
        } catch (err) {
          // User cancelled — silent
          if ((err as Error)?.name === 'AbortError') {
            setBusy(false)
            return
          }
          // Other errors — fall through to manual path
        }
      }

      // Desktop fallback: download the card image, copy the caption, open IG.
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)

      await copyToClipboard(data.caption)
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer')
      setToast({
        kind: 'ok',
        text: 'Imagen y caption listos. Pégalos en tu Historia.',
      })
    } catch {
      setToast({ kind: 'err', text: 'No se pudo preparar la imagen.' })
    }
    setBusy(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        disabled={busy}
        className={`pressable relative overflow-hidden flex items-center justify-center gap-2 px-3 sm:px-4 py-3 text-white font-semibold text-xs sm:text-sm whitespace-nowrap disabled:opacity-60 ${className || ''}`}
        style={{
          background:
            'linear-gradient(45deg, #f9ce34 0%, #ee2a7b 45%, #6228d7 100%)',
        }}
        aria-label="Compartir en Instagram Historia"
      >
        <svg
          className="w-4 h-4 sm:w-5 sm:h-5 shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.06 1.8.25 2.23.42.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.42 2.23.06 1.25.07 1.65.07 4.85s0 3.6-.07 4.85c-.06 1.17-.26 1.8-.42 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.42-1.25.06-1.65.07-4.85.07s-3.6 0-4.85-.07c-1.17-.06-1.8-.26-2.23-.42a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.42-2.23C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.85c.06-1.17.25-1.8.42-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.42C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.15 0-3.5 0-4.74.07-1.07.05-1.65.23-2.04.38-.51.2-.88.44-1.27.83-.39.39-.63.76-.83 1.27-.15.39-.33.97-.38 2.04C2.67 9.83 2.67 10.18 2.67 12s0 2.17.07 3.41c.05 1.07.23 1.65.38 2.04.2.51.44.88.83 1.27.39.39.76.63 1.27.83.39.15.97.33 2.04.38 1.24.07 1.59.07 4.74.07s3.5 0 4.74-.07c1.07-.05 1.65-.23 2.04-.38.51-.2.88-.44 1.27-.83.39-.39.63-.76.83-1.27.15-.39.33-.97.38-2.04.07-1.24.07-1.59.07-4.74s0-3.5-.07-4.74c-.05-1.07-.23-1.65-.38-2.04a3.34 3.34 0 0 0-.83-1.27 3.34 3.34 0 0 0-1.27-.83c-.39-.15-.97-.33-2.04-.38C15.5 4 15.15 4 12 4z" />
          <path d="M12 7.07a4.93 4.93 0 1 0 0 9.86 4.93 4.93 0 0 0 0-9.86zm0 8.13a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4z" />
          <circle cx="17.13" cy="6.87" r="1.18" />
        </svg>
        <span>{busy ? 'Preparando…' : 'Compartir en Historia'}</span>
      </button>

      {toast && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 bottom-6 z-50 px-4 py-2 rounded-full text-sm shadow-lg ${
            toast.kind === 'ok' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
          }`}
          role="status"
        >
          {toast.text}
        </div>
      )}
    </>
  )
}
