'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      {/* Warning mountain */}
      <svg viewBox="0 0 120 100" fill="none" className="w-32 text-gray-300 mb-6">
        <path d="M10 85 L60 20 L110 85 Z" fill="currentColor" opacity={0.06} />
        <path d="M10 85 L60 20 L110 85 Z" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" fill="none" opacity={0.2} />
        <line x1="60" y1="42" x2="60" y2="62" stroke="currentColor" strokeWidth={3} strokeLinecap="round" opacity={0.25} />
        <circle cx="60" cy="72" r="2" fill="currentColor" opacity={0.25} />
      </svg>

      <h1 className="font-body text-2xl font-black text-gray-900 mb-2">Algo salio mal</h1>
      <p className="text-gray-400 text-sm max-w-xs mb-8">
        Ocurrio un error inesperado. Intenta de nuevo o vuelve al inicio.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="pressable bg-brand-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          Reintentar
        </button>
        <a
          href="/"
          className="pressable border border-gray-200 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Ir al inicio
        </a>
      </div>
    </div>
  )
}
