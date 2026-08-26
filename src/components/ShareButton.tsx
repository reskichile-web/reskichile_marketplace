'use client'

import { useEffect, useRef, useState } from 'react'
import { generateStoryCard } from '@/lib/story-card'
import {
  canNativeShare,
  copyToClipboard,
  productShareData,
  whatsappShareUrl,
} from '@/lib/share'
import type { ProductWithImages } from '@/lib/types'

interface Props {
  product: ProductWithImages
  className?: string
  iconOnly?: boolean
}

type Toast = { kind: 'ok' | 'err'; text: string } | null

interface ShareTarget {
  id: string
  label: string
  hint?: string
  iconBg: string
  icon: React.ReactNode
  run: () => Promise<Toast> | Toast
}

export default function ShareButton({ product, className, iconOnly = false }: Props) {
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const popRef = useRef<HTMLDivElement>(null)
  // Pre-built story-card file, cached as soon as the component mounts so
  // that the click handler can hand it to navigator.share synchronously —
  // any await between the user gesture and navigator.share consumes the
  // activation on Safari/iOS and the share silently fails.
  const storyFileRef = useRef<File | null>(null)

  useEffect(() => {
    let cancelled = false
    generateStoryCard(product)
      .then((file) => {
        if (!cancelled) storyFileRef.current = file
      })
      .catch(() => {
        // ignored — we'll just share the link-only payload as fallback
      })
    return () => {
      cancelled = true
    }
  }, [product])

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
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  async function handlePrimaryClick() {
    if (busy) return
    const data = productShareData(product)
    const file = storyFileRef.current

    if (canNativeShare()) {
      // Prefer sharing the story-card image when it's ready and the OS
      // supports file shares. No awaits before navigator.share — keeps
      // the user-activation gesture alive on Safari/iOS.
      const payload: ShareData =
        file && canNativeShare({ files: [file] })
          ? { files: [file], title: data.title, text: data.caption }
          : { title: data.title, text: data.text, url: data.url }
      try {
        await navigator.share(payload)
        return
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        // unexpected failure — fall through to dropdown
      }
    }

    // Desktop / no native share: open the dropdown of targets.
    setOpen(true)
  }

  async function runTarget(t: ShareTarget) {
    // Each target owns its own async work — we don't pre-await
    // generateStoryCard here because Safari consumes the user-activation
    // gesture during the await, breaking navigator.clipboard.writeText
    // and similar APIs.
    setBusy(true)
    try {
      const res = await t.run()
      if (res) setToast(res)
    } catch {
      setToast({ kind: 'err', text: 'Error al compartir' })
    }
    setBusy(false)
    setOpen(false)
  }

  const data = productShareData(product)

  const targets: ShareTarget[] = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      hint: 'Compartir el link por chat',
      iconBg: 'bg-green-600 text-white',
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
      id: 'download',
      label: 'Descargar imagen',
      hint: 'Para subirla a Instagram, etc.',
      iconBg: 'bg-gradient-to-br from-fuchsia-500 via-pink-500 to-amber-400 text-white',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v13" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5 5 5-5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 21h14" />
        </svg>
      ),
      run: async () => {
        const file = await generateStoryCard(product).catch(() => null)
        if (!file) return { kind: 'err', text: 'No se pudo generar la imagen' }
        const url = URL.createObjectURL(file)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 4000)
        return { kind: 'ok', text: 'Imagen descargada' }
      },
    },
    {
      id: 'copy',
      label: 'Copiar link',
      iconBg: 'bg-gray-100 text-gray-900',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-4.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 4H6a2 2 0 0 0-2 2v10" />
        </svg>
      ),
      run: async () => {
        const ok = await copyToClipboard(data.url)
        return ok
          ? { kind: 'ok', text: 'Link copiado' }
          : { kind: 'err', text: 'No se pudo copiar' }
      },
    },
  ]

  return (
    <>
      <div ref={popRef} className={`relative ${className || 'inline-block'}`}>
        <button
          type="button"
          onClick={handlePrimaryClick}
          disabled={busy}
          className={`pressable flex w-full items-center justify-center disabled:opacity-60 ${
            iconOnly
              ? 'h-full p-0 text-gray-400 transition-colors hover:text-gray-600'
              : 'gap-1.5 whitespace-nowrap border border-gray-300 bg-white px-3 py-3 text-xs font-medium text-gray-900 hover:bg-gray-50 sm:gap-2 sm:px-4 sm:text-sm'
          }`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={iconOnly ? (busy ? 'Preparando opciones para compartir' : 'Compartir producto') : undefined}
          title={iconOnly ? 'Compartir producto' : undefined}
        >
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 6l-4-4-4 4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v14" />
          </svg>
          <span className={iconOnly ? 'sr-only' : ''}>{busy ? 'Preparando…' : 'Compartir'}</span>
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-2 w-72 rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Compartir producto
              </p>
              <p className="text-sm text-gray-900 truncate mt-0.5">{data.title}</p>
            </div>
            <ul className="py-1.5">
              {targets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => runTarget(t)}
                    disabled={busy}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 disabled:opacity-50 text-left"
                    role="menuitem"
                  >
                    <span
                      className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg ${t.iconBg}`}
                    >
                      {t.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-900">{t.label}</span>
                      {t.hint && <span className="block text-xs text-gray-500">{t.hint}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

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
