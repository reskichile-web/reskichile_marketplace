'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { copyToClipboard } from '@/lib/share'

export default function CopyOrderNumberButton({ orderNumber }: { orderNumber: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const timeout = window.setTimeout(() => setState('idle'), 2200)
    return () => window.clearTimeout(timeout)
  }, [state])

  async function handleCopy() {
    setState(await copyToClipboard(orderNumber) ? 'copied' : 'error')
  }

  const label = state === 'copied'
    ? 'Número de orden copiado'
    : state === 'error'
      ? 'No se pudo copiar el número de orden'
      : 'Copiar número de orden'

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={label}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
        state === 'error' ? 'text-red-500' : state === 'copied' ? 'text-brand-500' : 'text-gray-500 hover:text-gray-950'
      }`}
    >
      {state === 'copied' ? (
        <Check className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
      ) : (
        <Copy className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
      )}
    </button>
  )
}
