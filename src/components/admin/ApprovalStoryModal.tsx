'use client'

import Spinner from '@/components/Spinner'
import type {
  InstagramStoryCaptureResult,
  InstagramStoryProductSummary,
} from '@/lib/instagram/contracts'

export type ApprovalStoryModalState =
  | {
      phase: 'working'
      operation: 'approve' | 'retry'
      product: InstagramStoryProductSummary
    }
  | {
      phase: 'ready'
      product: InstagramStoryProductSummary
      story: InstagramStoryCaptureResult
    }
  | {
      phase: 'capture-failed'
      product: InstagramStoryProductSummary
      story: InstagramStoryCaptureResult
    }
  | {
      phase: 'approval-failed'
      product: InstagramStoryProductSummary
      error: string
    }

interface ApprovalStoryModalProps {
  state: ApprovalStoryModalState | null
  onClose: () => void
  onRetry: () => void
}

function cacheBustedUrl(url: string, updatedAt: string): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${encodeURIComponent(updatedAt)}`
}

export default function ApprovalStoryModal({
  state,
  onClose,
  onRetry,
}: ApprovalStoryModalProps) {
  if (!state) return null

  const working = state.phase === 'working'
  const ready = state.phase === 'ready'
  const storyUrl = ready && state.story.jpegPublicUrl
    ? cacheBustedUrl(state.story.jpegPublicUrl, state.story.updatedAt)
    : null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-story-title"
      data-testid="approval-story-modal"
    >
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {working ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
            <Spinner size="lg" color="brand" />
            <h2 id="approval-story-title" className="mt-6 text-xl font-black text-gray-900">
              {state.operation === 'approve'
                ? 'Aprobando producto y generando Story…'
                : 'Generando nuevamente la Story…'}
            </h2>
            <p className="mt-2 max-w-md text-sm text-gray-500">
              Mantén esta ventana abierta. Podrás aprobar el siguiente producto cuando termine.
            </p>
          </div>
        ) : ready ? (
          <>
            <div className="border-b border-gray-100 px-6 py-4 text-center">
              <h2 id="approval-story-title" className="text-xl font-black text-gray-900">
                Producto aprobado · Story preparada
              </h2>
              <p className="mt-1 text-sm text-gray-500">{state.product.title}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {storyUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={storyUrl}
                  alt={`Story preparada para ${state.product.title}`}
                  className="mx-auto max-h-[70vh] w-auto max-w-full rounded-xl border border-gray-200 bg-gray-50 object-contain shadow-sm"
                  style={{ aspectRatio: '9 / 16' }}
                  data-testid="approval-story-preview"
                />
              )}
              <div className="mx-auto mt-3 flex max-w-md flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>{state.product.slug}</span>
                <span>1080×1920</span>
                <span>JPEG sRGB</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              {storyUrl && (
                <a
                  href={storyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
                >
                  Abrir Story
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </>
        ) : (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9L2.6 17.2A2 2 0 004.3 20h15.4a2 2 0 001.7-2.8L13.7 3.9a2 2 0 00-3.4 0z" />
              </svg>
            </div>
            <h2 id="approval-story-title" className="mt-4 text-xl font-black text-gray-900">
              {state.phase === 'capture-failed'
                ? 'Producto aprobado, pero no pudimos generar la Story'
                : 'No pudimos completar la aprobación'}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500">
              {state.phase === 'capture-failed'
                ? state.story.error || 'La publicación ya está visible en ReskiChile. Puedes reintentar sólo la captura.'
                : state.error}
            </p>
            <p className="mt-3 text-xs text-gray-400">{state.product.title}</p>
            <div className="mt-6 flex justify-center gap-2">
              {state.phase === 'capture-failed' && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
                >
                  Reintentar captura
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
