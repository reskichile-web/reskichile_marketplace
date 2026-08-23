'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Star, Wrench, X } from 'lucide-react'
import { RiChat3Fill } from 'react-icons/ri'

type Phase = 'comment' | 'rating'

interface FeedbackResponse {
  id?: string
  ratingToken?: string
  error?: string
}

interface FeedbackWidgetProps {
  pagePath: string
  expanded?: boolean
}

export default function FeedbackWidget({ pagePath, expanded = false }: FeedbackWidgetProps) {
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
        body: JSON.stringify({ message: trimmed, pagePath }),
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
        className="group fixed bottom-5 right-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center text-left transition-transform hover:-translate-y-0.5 sm:bottom-6 sm:right-6"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="feedback-dialog"
        aria-label={expanded ? undefined : 'Danos tu opinión'}
      >
        <span className={`mr-[-20px] min-w-0 overflow-hidden rounded-2xl border border-r-0 bg-white py-2 pl-3 pr-7 shadow-[0_7px_18px_rgba(38,116,191,0.13)] transition-[width,opacity,transform,border-color] duration-200 ${
          expanded
            ? 'w-[240px] border-brand-200 opacity-100 group-hover:border-brand-300'
            : 'pointer-events-none w-0 -translate-x-2 border-transparent opacity-0 group-hover:w-[240px] group-hover:translate-x-0 group-hover:border-brand-200 group-hover:opacity-100 group-focus-visible:w-[240px] group-focus-visible:translate-x-0 group-focus-visible:border-brand-200 group-focus-visible:opacity-100'
        }`}>
          <span className="flex w-[200px] items-center gap-1.5 whitespace-nowrap font-body text-[13px] font-normal tracking-[-0.025em] text-gray-500">
            <Wrench data-testid="feedback-wrench" className="h-4 w-4 shrink-0 text-brand-500" strokeWidth={2.2} aria-hidden="true" />
            <span>¿Algo por mejorar/reparar?</span>
          </span>
          <span className="mt-0.5 block w-[200px] whitespace-nowrap pl-[22px] text-xs font-bold leading-tight text-brand-500">
            Danos tu opinión
          </span>
        </span>
        <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-white bg-[radial-gradient(circle_at_34%_24%,#a9cbeb_0%,#4a93d3_48%,#2674bf_100%)] ring-2 ring-brand-200 transition-transform group-hover:scale-[1.03] ${
          expanded
            ? 'h-[82px] w-[82px] border-4 shadow-[0_9px_22px_rgba(38,116,191,0.28),inset_0_1px_0_rgba(255,255,255,0.55)]'
            : 'h-14 w-14 border-[3px] shadow-[0_6px_16px_rgba(38,116,191,0.22),inset_0_1px_0_rgba(255,255,255,0.5)] sm:h-16 sm:w-16'
        }`}>
          <RiChat3Fill
            className={expanded
              ? 'h-14 w-14 translate-x-px -translate-y-px text-white'
              : 'h-9 w-9 translate-x-px -translate-y-px text-white sm:h-10 sm:w-10'}
            aria-hidden="true"
          />
        </span>
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
                  Reporta algo o deja un comentario <span aria-hidden="true">❤️</span>
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
