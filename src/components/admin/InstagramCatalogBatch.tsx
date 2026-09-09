'use client'

/* eslint-disable @next/next/no-img-element */
import { AlertCircle, CheckCircle2, Clock3, Loader2 } from 'lucide-react'
import type { InstagramAdminCatalogBatch } from '@/lib/instagram/catalog-contracts'
import { displayChileTime } from '@/lib/instagram/admin-ui'

export function catalogPreparationTime(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return `${String(hour - 1).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function CatalogBatchPreview({ batch }: { batch?: InstagramAdminCatalogBatch }) {
  return <div>
    <p className="text-sm font-semibold text-blue-900">Catálogo trending · intro + láminas</p>
    {!!batch?.slides.length && <div className="mt-2 flex gap-2">
      {batch.slides.map(slide => <a key={slide.position} href={slide.imageUrl} target="_blank" rel="noreferrer"
        aria-label={slide.kind === 'intro' ? 'Ver intro del catálogo' : `Ver lámina ${slide.position} del catálogo`}
        className="relative overflow-hidden rounded border border-blue-100 bg-gray-50 hover:border-blue-500">
        <img src={slide.imageUrl} alt={slide.kind === 'intro' ? 'Intro' : `Lámina ${slide.position}`} className="h-20 w-[45px] object-contain" loading="lazy" />
        {slide.publishedAt && <CheckCircle2 className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-white text-emerald-600" />}
      </a>)}
    </div>}
  </div>
}

export function CatalogBatchState({ batch, overdue, available, enabled }: {
  batch?: InstagramAdminCatalogBatch; overdue: boolean; available: boolean; enabled: boolean
}) {
  const error = batch?.status === 'failed' || batch?.status === 'retry'
  const working = batch?.status === 'generating' || batch?.status === 'publishing'
  const success = batch?.status === 'published' || batch?.status === 'ready'
  const text = !available ? 'Falta activar base de datos'
    : batch?.status === 'published' ? 'Publicada'
      : error ? (batch.generatedAt ? 'Error de publicación' : 'Error de generación')
        : batch?.status === 'generating' ? 'Generando'
          : batch?.status === 'publishing' ? 'Publicando'
            : batch?.status === 'ready' ? 'Generada correctamente'
              : batch?.status === 'skipped' ? 'Sin productos'
                : !enabled ? 'Automatización desactivada' : overdue ? 'No generada' : 'Pendiente de generación'
  const warning = error || (overdue && !batch?.generatedAt && enabled)
  const Icon = working ? Loader2 : success ? CheckCircle2 : warning ? AlertCircle : Clock3
  return <div>
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${warning ? 'bg-red-50 text-red-700' : success ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${working ? 'animate-spin' : ''}`} />{text}
    </span>
    {batch?.generatedAt && <p className="mt-1 text-[10px] text-gray-500">Generada a las {displayChileTime(batch.generatedAt)}</p>}
    {!!batch?.slides.length && <p className="mt-1 text-[10px] text-gray-500">{batch.slides.filter(s => s.publishedAt).length}/{batch.slides.length} historias publicadas</p>}
  </div>
}

export function CatalogBatchDetails({ batch, time }: { batch?: InstagramAdminCatalogBatch; time: string }) {
  return <div className="text-xs text-gray-500">
    <p>Generación {catalogPreparationTime(time)} · publicación {time}</p>
    {batch?.lastError && <p role="status" className="mt-1 max-w-xs text-red-700">{batch.lastError}</p>}
    {!!batch?.generationAttempts && <p className="mt-1 text-[10px]">Intentos de generación: {batch.generationAttempts}</p>}
  </div>
}
