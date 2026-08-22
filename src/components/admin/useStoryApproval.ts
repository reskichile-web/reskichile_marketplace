'use client'

import { useCallback, useMemo, useState } from 'react'
import type {
  AdminApprovalResponse,
  AdminStoryRetryResponse,
  InstagramStoryProductSummary,
} from '@/lib/instagram/contracts'
import type { ApprovalStoryModalState } from './ApprovalStoryModal'

interface UseStoryApprovalOptions {
  onApproved: (response: AdminApprovalResponse) => void
}

interface ErrorPayload {
  error?: string
}

async function responseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({})) as ErrorPayload
  return body.error || 'No pudimos completar la operación'
}

export function useStoryApproval({ onApproved }: UseStoryApprovalOptions) {
  const [state, setState] = useState<ApprovalStoryModalState | null>(null)
  const busy = state?.phase === 'working'

  const approve = useCallback(async (product: InstagramStoryProductSummary) => {
    if (busy) return
    setState({ phase: 'working', operation: 'approve', product })
    try {
      const response = await fetch(`/api/admin/products/${product.id}/approve`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) throw new Error(await responseError(response))
      const result = await response.json() as AdminApprovalResponse
      onApproved(result)
      setState(result.story.status === 'ready' && result.story.jpegPublicUrl
        ? { phase: 'ready', product: result.product, story: result.story }
        : { phase: 'capture-failed', product: result.product, story: result.story })
    } catch (error) {
      setState({
        phase: 'approval-failed',
        product,
        error: error instanceof Error ? error.message : 'No pudimos completar la aprobación',
      })
    }
  }, [busy, onApproved])

  const retry = useCallback(async () => {
    if (!state || state.phase !== 'capture-failed') return
    const product = state.product
    setState({ phase: 'working', operation: 'retry', product })
    try {
      const response = await fetch(`/api/admin/products/${product.id}/instagram-story/retry`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) throw new Error(await responseError(response))
      const result = await response.json() as AdminStoryRetryResponse
      setState(result.story.status === 'ready' && result.story.jpegPublicUrl
        ? { phase: 'ready', product: result.product, story: result.story }
        : { phase: 'capture-failed', product: result.product, story: result.story })
    } catch (error) {
      setState({
        phase: 'capture-failed',
        product,
        story: {
          id: '',
          status: 'failed',
          jpegPublicUrl: null,
          updatedAt: new Date().toISOString(),
          width: 1080,
          height: 1920,
          format: 'jpeg',
          error: error instanceof Error ? error.message : 'No pudimos generar la Story',
        },
      })
    }
  }, [state])

  const close = useCallback(() => {
    setState((current) => current?.phase === 'working' ? current : null)
  }, [])

  return useMemo(() => ({ state, busy, approve, retry, close }), [state, busy, approve, retry, close])
}
