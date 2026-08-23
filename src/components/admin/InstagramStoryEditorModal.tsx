'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  ImagePlus,
  RefreshCw,
  Send,
  X,
} from 'lucide-react'
import PublishLoadingDots from '@/components/PublishLoadingDots'
import type { InstagramAdminProduct } from '@/lib/instagram/admin-contracts'
import {
  displayLocalDate,
  formatClp,
  storyStatus,
} from '@/lib/instagram/admin-ui'
import { instagramStoryRuleForDate } from '@/lib/instagram/schedule-rules'

export interface InstagramSlotOption {
  key: string
  localDate: string
  slot: number
  time: string
  label: string
}

interface Props {
  product: InstagramAdminProduct
  publishingEnabled: boolean
  slots: InstagramSlotOption[]
  onClose: () => void
  onChanged: () => Promise<void>
}

type WorkingAction = 'generate' | 'schedule' | 'publish' | null

async function responseError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => ({})) as { error?: string }
  return payload.error || 'No pudimos completar la operación'
}

function currentSchedule(product: InstagramAdminProduct): string | null {
  const capture = product.capture
  if (!capture?.scheduledLocalDate || !capture.scheduledSlot) return null
  const rule = instagramStoryRuleForDate(capture.scheduledLocalDate)
  const time = rule.slots.find((item) => item.slot === capture.scheduledSlot)?.time
  return `${displayLocalDate(capture.scheduledLocalDate, true)} · ${time || ''}`
}

export default function InstagramStoryEditorModal({
  product,
  publishingEnabled,
  slots,
  onClose,
  onChanged,
}: Props) {
  const [working, setWorking] = useState<WorkingAction>(null)
  const [error, setError] = useState('')
  const [generatedPreview, setGeneratedPreview] = useState<{
    captureId: string
    url: string
    updatedAt: string
  } | null>(null)

  useEffect(() => {
    setError('')
    setGeneratedPreview(null)
  }, [product.id])

  const capture = product.capture
  const previewUrl = generatedPreview?.url || capture?.jpegPublicUrl || null
  const previewUpdatedAt = generatedPreview?.updatedAt || capture?.updatedAt || ''
  const captureId = generatedPreview?.captureId || capture?.id || ''
  const prepared = Boolean(previewUrl && (generatedPreview || capture?.generatedAt))
  const published = capture?.status === 'published'
  const state = storyStatus(product)

  async function scheduleRequest(body: Record<string, unknown>) {
    const response = await fetch('/api/admin/instagram-stories/schedule', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(await responseError(response))
    return response.json()
  }

  async function resetPublishingFailureIfNeeded() {
    if (capture?.status === 'failed' && capture.generatedAt && capture.jpegPublicUrl) {
      await scheduleRequest({ captureId: capture.id, action: 'retry-publishing' })
    }
  }

  async function generateStory(force = false) {
    if (working) return
    setWorking('generate')
    setError('')
    try {
      const response = await fetch(`/api/admin/products/${product.id}/instagram-story/retry`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: false, force }),
      })
      if (!response.ok) throw new Error(await responseError(response))
      const result = await response.json() as {
        story: {
          id: string
          status: string
          jpegPublicUrl: string | null
          updatedAt: string
          error?: string
        }
      }
      if (result.story.status !== 'ready' || !result.story.jpegPublicUrl) {
        throw new Error(result.story.error || 'No pudimos generar la Story')
      }
      setGeneratedPreview({
        captureId: result.story.id,
        url: result.story.jpegPublicUrl,
        updatedAt: result.story.updatedAt,
      })
      await onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos generar la Story')
    } finally {
      setWorking(null)
    }
  }

  async function addToNextSlot() {
    if (!captureId || working) return
    setWorking('schedule')
    setError('')
    try {
      await resetPublishingFailureIfNeeded()
      if (capture?.scheduledFor) {
        await scheduleRequest({ captureId, action: 'unschedule' })
      }
      await scheduleRequest({ captureId, action: 'next' })
      await onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos agregar la Story al cron')
    } finally {
      setWorking(null)
    }
  }

  async function addToSpecificSlot(target: string) {
    if (!captureId || !target || working) return
    const [localDate, slot] = target.split('|')
    setWorking('schedule')
    setError('')
    try {
      await resetPublishingFailureIfNeeded()
      await scheduleRequest({
        captureId,
        action: 'move',
        localDate,
        slot: Number(slot),
      })
      await onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos asignar ese cupo')
    } finally {
      setWorking(null)
    }
  }

  async function publishNow() {
    if (!captureId || working || !publishingEnabled) return
    if (!window.confirm(`¿Publicar ahora la Story de ${product.title} en @reskichile?`)) return
    setWorking('publish')
    setError('')
    try {
      await resetPublishingFailureIfNeeded()
      const response = await fetch('/api/admin/instagram-stories/publish-now', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captureId,
          confirmation: 'PUBLICAR_EN_INSTAGRAM',
        }),
      })
      if (!response.ok) throw new Error(await responseError(response))
      await onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos publicar la Story')
    } finally {
      setWorking(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/70 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-editor-title"
    >
      <div className="relative flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={Boolean(working)}
          aria-label="Cerrar"
          className="absolute right-4 top-4 z-20 rounded-full bg-white/90 p-2 text-gray-500 shadow-sm transition hover:bg-white hover:text-gray-950 disabled:opacity-40"
        >
          <X className="h-5 w-5" />
        </button>

        {working === 'generate' ? (
          <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center">
            <PublishLoadingDots />
            <h2 id="story-editor-title" className="mt-7 text-2xl font-black text-gray-950">
              Generando Story…
            </h2>
            <p className="mt-2 text-sm text-gray-400">Renderizando y guardando el JPEG de 1080×1920.</p>
            <p className="mt-5 font-semibold text-gray-600">{product.title}</p>
          </div>
        ) : !prepared ? (
          <div className="grid min-h-[520px] md:grid-cols-[0.9fr_1.1fr]">
            <div className="flex items-center justify-center bg-gray-50 p-8">
              <div className="aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 shadow-sm">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.title} className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-300"><ImagePlus className="h-16 w-16" /></div>
                )}
              </div>
            </div>
            <div className="flex flex-col justify-center p-8 sm:p-12">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-500">Preparar Story</p>
              <h2 id="story-editor-title" className="mt-3 font-body text-3xl font-black leading-tight text-gray-950">{product.title}</h2>
              <p className="mt-3 text-lg font-semibold text-gray-500">{formatClp(product.price)}</p>
              <span className={`mt-5 w-fit rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${state.className}`}>{state.label}</span>
              {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
              <button
                type="button"
                onClick={() => void generateStory()}
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-brand-600"
              >
                <ImagePlus className="h-5 w-5" /> Generar historia
              </button>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(320px,0.75fr)_minmax(360px,1.25fr)]">
            <div className="flex min-h-0 items-center justify-center bg-gray-950 p-4 sm:p-6">
              <div className="aspect-[9/16] max-h-[82vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
                <img
                  src={`${previewUrl}?v=${encodeURIComponent(previewUpdatedAt)}`}
                  alt={`Story de ${product.title}`}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
            <div className="flex min-h-0 flex-col overflow-y-auto p-6 sm:p-9">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-500">Story preparada</p>
              <h2 id="story-editor-title" className="mt-2 pr-10 font-body text-2xl font-black leading-tight text-gray-950 sm:text-3xl">{product.title}</h2>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${state.className}`}>{state.label}</span>
                <span className="text-xs font-semibold text-gray-400">JPEG · 1080×1920</span>
                {!published && (
                  <button
                    type="button"
                    onClick={() => void generateStory(true)}
                    disabled={Boolean(working)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-[10px] font-bold text-gray-500 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerar historia
                  </button>
                )}
              </div>

              {currentSchedule(product) && (
                <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-500">Cupo actual</p>
                  <p className="mt-1 text-sm font-black text-blue-950">{currentSchedule(product)}</p>
                </div>
              )}

              {published ? (
                <div className="mt-8 flex items-center gap-3 rounded-2xl bg-emerald-50 p-5 text-emerald-800">
                  <CheckCircle2 className="h-6 w-6" />
                  <div>
                    <p className="font-black">Story publicada</p>
                    <p className="mt-0.5 text-xs text-emerald-600">Meta confirmó la publicación.</p>
                  </div>
                </div>
              ) : (
                <div className="mt-8 space-y-3">
                  <button
                    type="button"
                    onClick={() => void publishNow()}
                    disabled={!publishingEnabled || Boolean(working)}
                    title={!publishingEnabled ? 'INSTAGRAM_PUBLISHING_ENABLED está desactivado' : undefined}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 py-3.5 text-sm font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <Send className="h-5 w-5" /> Subir ahora
                  </button>
                  <button
                    type="button"
                    onClick={() => void addToNextSlot()}
                    disabled={Boolean(working)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3.5 text-sm font-black text-white transition hover:bg-brand-600 disabled:opacity-40"
                  >
                    <CalendarClock className="h-5 w-5" />
                    {capture?.scheduledFor ? 'Mover al próximo cupo' : 'Agregar al cron'}
                  </button>
                  <select
                    value=""
                    onChange={(event) => void addToSpecificSlot(event.target.value)}
                    disabled={Boolean(working) || slots.length === 0}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm font-bold text-gray-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-gray-50 disabled:text-gray-300"
                    aria-label="Agregar a una fecha específica"
                  >
                    <option value="">Agregar al cron en fecha específica…</option>
                    {slots.map((slot) => <option key={slot.key} value={slot.key}>{slot.label}</option>)}
                  </select>
                </div>
              )}

              {working && (
                <div className="mt-5 flex items-center gap-3 rounded-xl bg-brand-50 px-4 py-3 text-sm font-bold text-brand-700">
                  <PublishLoadingDots className="scale-75" />
                  {working === 'publish' ? 'Publicando en Instagram…' : 'Actualizando el calendario…'}
                </div>
              )}
              {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
