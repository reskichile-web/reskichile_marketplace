'use client'

import { useEffect, useRef, useState } from 'react'
import { Heart, Send, Star, X } from 'lucide-react'
import { usePathname } from 'next/navigation'

type Phase = 'comment' | 'rating'

interface FeedbackResponse {
  id?: string
  ratingToken?: string
  error?: string
}

interface FeedbackWidgetProps {
  pagePath?: string
}

export default function FeedbackWidget({ pagePath }: FeedbackWidgetProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('comment')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [feedbackId, setFeedbackId] = useState('')
  const [ratingToken, setRatingToken] = useState('')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (phase === 'comment') requestAnimationFrame(() => textareaRef.current?.focus())

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', closeWithEscape)
    return () => {
      document.removeEventListener('keydown', closeWithEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [open, phase])

  function closeModal() {
    setOpen(false)
    window.setTimeout(() => {
      setPhase('comment')
      setMessage('')
      setError('')
      setFeedbackId('')
      setRatingToken('')
      setRating(0)
      setHoverRating(0)
    }, 200)
  }

  async function submitComment() {
    const trimmed = message.trim()
    if (trimmed.length < 2 || sending) return

    setSending(true)
    setError('')
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, pagePath: pagePath ?? pathname }),
      })
      const data = await response.json() as FeedbackResponse
      if (!response.ok || !data.id || !data.ratingToken) {
        throw new Error(data.error || 'No pudimos enviarlo')
      }
      setFeedbackId(data.id)
      setRatingToken(data.ratingToken)
      setPhase('rating')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No pudimos enviarlo')
    } finally {
      setSending(false)
    }
  }

  async function submitRating(nextRating: number) {
    if (!feedbackId || !ratingToken) return
    setRating(nextRating)
    setError('')

    try {
      const response = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: feedbackId, ratingToken, rating: nextRating }),
      })
      const data = await response.json() as FeedbackResponse
      if (!response.ok) throw new Error(data.error || 'No pudimos guardar las estrellas')
      closeModal()
    } catch (ratingError) {
      setRating(0)
      setError(ratingError instanceof Error ? ratingError.message : 'No pudimos guardar las estrellas')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full border border-gray-300 px-7 py-3.5 text-sm font-semibold text-gray-800 transition-colors hover:border-brand-500 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="feedback-dialog"
      >
        <Heart className="h-5 w-5" fill="none" strokeWidth={1.6} aria-hidden="true" />
        Deja tu comentario
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeModal()
          }}
        >
          <section
            id="feedback-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            className="relative w-full max-w-md rounded-3xl border border-brand-100 bg-white p-6 shadow-2xl sm:p-7"
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            {phase === 'comment' ? (
              <form onSubmit={event => { event.preventDefault(); void submitComment() }}>
                <h2 id="feedback-title" className="max-w-xs pr-8 font-body text-2xl font-black leading-tight text-gray-950">
                  Deja tu comentario <Heart className="inline h-6 w-6 align-middle" fill="none" strokeWidth={1.6} aria-hidden="true" />
                </h2>
                <label htmlFor="feedback-message" className="sr-only">Comentario</label>
                <textarea
                  ref={textareaRef}
                  id="feedback-message"
                  value={message}
                  onChange={event => setMessage(event.target.value)}
                  maxLength={1000}
                  placeholder="Escribe aquí…"
                  className="mt-6 min-h-36 w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:bg-white focus:ring-4 focus:ring-brand-50"
                />
                <p className="mt-1.5 text-[11px] font-light text-gray-400">
                  Para el equipo es muy importante tu opinión. ¡Gracias!
                </p>
                {error && <p role="alert" className="mt-2 text-xs font-medium text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={message.trim().length < 2 || sending}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-bold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {sending ? 'Enviando…' : 'Enviar'}
                </button>
              </form>
            ) : (
              <div className="py-5 text-center">
                <h2 id="feedback-title" className="font-body text-3xl font-black leading-tight text-gray-950">
                  ¿Qué te parece ReskiChile?
                </h2>
                <div
                  className="mt-8 flex items-center justify-center gap-1 sm:gap-2"
                  onMouseLeave={() => setHoverRating(0)}
                  aria-label="Califica de 1 a 5 estrellas"
                >
                  {[1, 2, 3, 4, 5].map(value => {
                    const active = value <= (hoverRating || rating)
                    return (
                      <button
                        key={value}
                        type="button"
                        onMouseEnter={() => setHoverRating(value)}
                        onFocus={() => setHoverRating(value)}
                        onBlur={() => setHoverRating(0)}
                        onClick={() => void submitRating(value)}
                        className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 sm:h-14 sm:w-14 ${active ? 'text-amber-400' : 'text-gray-200'}`}
                        aria-label={`${value} ${value === 1 ? 'estrella' : 'estrellas'}`}
                        aria-pressed={rating === value}
                      >
                        <Star className="h-9 w-9 sm:h-11 sm:w-11" fill={active ? 'currentColor' : 'none'} strokeWidth={1.7} aria-hidden="true" />
                      </button>
                    )
                  })}
                </div>
                {error && <p role="alert" className="mt-4 text-xs font-medium text-red-600">{error}</p>}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}
