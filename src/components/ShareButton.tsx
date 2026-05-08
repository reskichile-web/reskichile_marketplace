'use client'

import { useEffect, useRef, useState } from 'react'
import {
  productShareData,
  fetchImageAsFile,
  copyToClipboard,
  whatsappShareUrl,
  facebookShareUrl,
  canNativeShare,
} from '@/lib/share'
import type { ProductWithImages } from '@/lib/types'

interface Props {
  product: ProductWithImages
  className?: string
}

type Toast = { kind: 'ok' | 'err'; text: string } | null

interface ShareTarget {
  id: string
  label: string
  hint?: string
  icon: React.ReactNode
  accent: string
  run: () => Promise<Toast> | Toast
}

export default function ShareButton({ product, className }: Props) {
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const data = productShareData(product)

  // Instagram path: best-effort.
  // - Mobile w/ Web Share API + file support → OS share sheet (user picks IG).
  // - Else: download image + copy caption + open instagram.com in new tab.
  async function shareInstagram(): Promise<Toast> {
    const imageFile = data.imageUrl
      ? await fetchImageAsFile(data.imageUrl, `${(product.brand || 'reski').toLowerCase()}.jpg`)
      : null

    if (imageFile && canNativeShare({ files: [imageFile] })) {
      try {
        await navigator.share({
          files: [imageFile],
          title: data.title,
          text: data.caption,
        } as ShareData)
        return { kind: 'ok', text: 'Compartido' }
      } catch (err) {
        // User cancelled — silent
        if ((err as Error)?.name === 'AbortError') return null
        // fall through to manual path
      }
    }

    // Manual desktop path: download image + copy caption, then redirect.
    if (imageFile) {
      const blobUrl = URL.createObjectURL(imageFile)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = imageFile.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 4000)
    }
    await copyToClipboard(data.caption)
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer')
    return { kind: 'ok', text: 'Imagen descargada y caption copiado' }
  }

  const targets: ShareTarget[] = [
    {
      id: 'instagram',
      label: 'Instagram',
      hint: 'Imagen + caption listos',
      accent:
        'bg-gradient-to-br from-fuchsia-500 via-pink-500 to-amber-400 text-white',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.06 1.8.25 2.23.42.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.42 2.23.06 1.25.07 1.65.07 4.85s0 3.6-.07 4.85c-.06 1.17-.26 1.8-.42 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.42-1.25.06-1.65.07-4.85.07s-3.6 0-4.85-.07c-1.17-.06-1.8-.26-2.23-.42a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.42-2.23C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.85c.06-1.17.25-1.8.42-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.42C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.15 0-3.5 0-4.74.07-1.07.05-1.65.23-2.04.38-.51.2-.88.44-1.27.83-.39.39-.63.76-.83 1.27-.15.39-.33.97-.38 2.04C2.67 9.83 2.67 10.18 2.67 12s0 2.17.07 3.41c.05 1.07.23 1.65.38 2.04.2.51.44.88.83 1.27.39.39.76.63 1.27.83.39.15.97.33 2.04.38 1.24.07 1.59.07 4.74.07s3.5 0 4.74-.07c1.07-.05 1.65-.23 2.04-.38.51-.2.88-.44 1.27-.83.39-.39.63-.76.83-1.27.15-.39.33-.97.38-2.04.07-1.24.07-1.59.07-4.74s0-3.5-.07-4.74c-.05-1.07-.23-1.65-.38-2.04a3.34 3.34 0 0 0-.83-1.27 3.34 3.34 0 0 0-1.27-.83c-.39-.15-.97-.33-2.04-.38C15.5 4 15.15 4 12 4z" />
          <path d="M12 7.07a4.93 4.93 0 1 0 0 9.86 4.93 4.93 0 0 0 0-9.86zm0 8.13a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4z" />
          <circle cx="17.13" cy="6.87" r="1.18" />
        </svg>
      ),
      run: shareInstagram,
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      accent: 'bg-green-600 text-white',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.592-.838-6.313-2.234l-.44-.362-3.09 1.036 1.036-3.09-.362-.44A9.958 9.958 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
        </svg>
      ),
      run: () => {
        window.open(whatsappShareUrl(data.text, data.url), '_blank', 'noopener,noreferrer')
        return null
      },
    },
    {
      id: 'facebook',
      label: 'Facebook',
      accent: 'bg-[#1877F2] text-white',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
        </svg>
      ),
      run: () => {
        window.open(facebookShareUrl(data.url), '_blank', 'noopener,noreferrer')
        return null
      },
    },
    {
      id: 'copy',
      label: 'Copiar link',
      accent: 'bg-gray-100 text-gray-900',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-4.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 4H6a2 2 0 0 0-2 2v10" />
        </svg>
      ),
      run: async () => {
        const ok = await copyToClipboard(data.url)
        return ok ? { kind: 'ok', text: 'Link copiado' } : { kind: 'err', text: 'No se pudo copiar' }
      },
    },
  ]

  async function handleClick(t: ShareTarget) {
    setBusyId(t.id)
    try {
      const res = await t.run()
      if (res) setToast(res)
    } catch {
      setToast({ kind: 'err', text: 'Error al compartir' })
    }
    setBusyId(null)
    setOpen(false)
  }

  return (
    <div ref={popRef} className={`relative ${className || 'inline-block'}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pressable w-full flex items-center justify-center gap-1.5 sm:gap-2 bg-white border border-gray-300 text-gray-900 px-3 sm:px-4 py-3 hover:bg-gray-50 font-medium text-xs sm:text-sm whitespace-nowrap"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 6l-4-4-4 4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v14" />
        </svg>
        Compartir
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-72 rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Compartir producto</p>
            <p className="text-sm text-gray-900 truncate mt-0.5">{data.title}</p>
          </div>
          <ul className="py-1.5">
            {targets.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => handleClick(t)}
                  disabled={busyId !== null}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 disabled:opacity-50 text-left"
                  role="menuitem"
                >
                  <span className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg ${t.accent}`}>
                    {t.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-gray-900">{t.label}</span>
                    {t.hint && <span className="block text-xs text-gray-500">{t.hint}</span>}
                  </span>
                  {busyId === t.id && (
                    <span className="text-xs text-gray-400">...</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
    </div>
  )
}
