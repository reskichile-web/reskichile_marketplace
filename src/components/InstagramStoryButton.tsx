'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { generateStoryCard } from '@/lib/story-card'
import { canNativeShare, copyToClipboard, productShareData } from '@/lib/share'
import type { ProductWithImages } from '@/lib/types'

interface Props {
  product: ProductWithImages
  className?: string
}

type Toast = { kind: 'ok' | 'err'; text: string } | null

function isMobileLike(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}

export default function InstagramStoryButton({ product, className }: Props) {
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const [showQr, setShowQr] = useState(false)
  const [pulse, setPulse] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const searchParams = useSearchParams()

  // QR-driven entry: when the user lands here via the desktop QR
  // (?openShare=1), scroll the button into view and pulse it. We can't
  // call navigator.share() programmatically — IG share requires a real
  // user tap — so we just make the button impossible to miss.
  useEffect(() => {
    if (searchParams.get('openShare') !== '1') return
    const url = new URL(window.location.href)
    url.searchParams.delete('openShare')
    window.history.replaceState(null, '', url.toString())
    const t = setTimeout(() => {
      buttonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setPulse(true)
    }, 250)
    return () => clearTimeout(t)
  }, [searchParams])

  useEffect(() => {
    if (!pulse) return
    const t = setTimeout(() => setPulse(false), 6000)
    return () => clearTimeout(t)
  }, [pulse])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  async function shareToIG() {
    if (busy) return
    setBusy(true)
    try {
      const data = productShareData(product)
      const file = await generateStoryCard(product)

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
          if ((err as Error)?.name === 'AbortError') {
            setBusy(false)
            return
          }
        }
      }

      // Last-resort fallback (mobile browsers without files share):
      // download the card + open IG so the user can upload manually.
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
      setToast({ kind: 'ok', text: 'Imagen y caption listos.' })
    } catch {
      setToast({ kind: 'err', text: 'No se pudo preparar la imagen.' })
    }
    setBusy(false)
  }

  function handleClick() {
    if (busy) return
    if (isMobileLike()) {
      shareToIG()
    } else {
      // IG Stories can only be uploaded from the IG mobile app — open a
      // QR pointing at this same page so the user can scan and continue
      // on their phone.
      setShowQr(true)
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={`pressable relative overflow-hidden flex items-center justify-center gap-2 px-3 sm:px-4 py-3 text-white font-semibold text-xs sm:text-sm whitespace-nowrap disabled:opacity-60 transition-shadow ${
          pulse ? 'ring-4 ring-pink-400/70 shadow-[0_0_24px_rgba(238,42,123,0.55)]' : ''
        } ${className || ''}`}
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

      {showQr && <QrModal product={product} onClose={() => setShowQr(false)} />}

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

function QrModal({
  product,
  onClose,
}: {
  product: ProductWithImages
  onClose: () => void
}) {
  const data = productShareData(product)
  const target = `${data.url}${data.url.includes('?') ? '&' : '?'}openShare=1`

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm bg-white rounded-2xl p-6 text-center shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>

        <div
          className="mx-auto inline-flex items-center justify-center w-12 h-12 rounded-xl text-white"
          style={{ background: 'linear-gradient(45deg, #f9ce34 0%, #ee2a7b 45%, #6228d7 100%)' }}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.06 1.8.25 2.23.42.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.42 2.23.06 1.25.07 1.65.07 4.85s0 3.6-.07 4.85c-.06 1.17-.26 1.8-.42 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.42-1.25.06-1.65.07-4.85.07s-3.6 0-4.85-.07c-1.17-.06-1.8-.26-2.23-.42a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.42-2.23C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.85c.06-1.17.25-1.8.42-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.42C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.15 0-3.5 0-4.74.07-1.07.05-1.65.23-2.04.38-.51.2-.88.44-1.27.83-.39.39-.63.76-.83 1.27-.15.39-.33.97-.38 2.04C2.67 9.83 2.67 10.18 2.67 12s0 2.17.07 3.41c.05 1.07.23 1.65.38 2.04.2.51.44.88.83 1.27.39.39.76.63 1.27.83.39.15.97.33 2.04.38 1.24.07 1.59.07 4.74.07s3.5 0 4.74-.07c1.07-.05 1.65-.23 2.04-.38.51-.2.88-.44 1.27-.83.39-.39.63-.76.83-1.27.15-.39.33-.97.38-2.04.07-1.24.07-1.59.07-4.74s0-3.5-.07-4.74c-.05-1.07-.23-1.65-.38-2.04a3.34 3.34 0 0 0-.83-1.27 3.34 3.34 0 0 0-1.27-.83c-.39-.15-.97-.33-2.04-.38C15.5 4 15.15 4 12 4z" />
            <path d="M12 7.07a4.93 4.93 0 1 0 0 9.86 4.93 4.93 0 0 0 0-9.86zm0 8.13a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4z" />
            <circle cx="17.13" cy="6.87" r="1.18" />
          </svg>
        </div>

        <h3 className="mt-3 text-lg font-bold text-gray-900">Sigue desde tu celular</h3>
        <p className="mt-1 text-sm text-gray-600">
          Instagram solo permite subir Historias desde la app móvil. Escanea este código y abrelo en tu teléfono.
        </p>

        <div className="mt-5 inline-flex items-center justify-center p-4 bg-white rounded-2xl border border-gray-200">
          <QRCodeSVG
            value={target}
            size={224}
            level="M"
            fgColor="#0f172a"
            bgColor="#ffffff"
          />
        </div>

        <ol className="mt-5 text-left text-sm text-gray-700 space-y-1.5">
          <li>1. Abre la cámara de tu teléfono.</li>
          <li>2. Apuntala al QR y toca la notificación.</li>
          <li>3. Toca el botón rosa para compartir en Historia.</li>
        </ol>
      </div>
    </div>
  )
}
