'use client'

import { useEffect } from 'react'
import Link from 'next/link'

function AnimatedDots() {
  return (
    <span className="inline-flex w-6">
      <span className="animate-[dot_1.4s_ease-in-out_infinite]">.</span>
      <span className="animate-[dot_1.4s_ease-in-out_0.2s_infinite]">.</span>
      <span className="animate-[dot_1.4s_ease-in-out_0.4s_infinite]">.</span>
      <style>{`
        @keyframes dot {
          0%, 20% { opacity: 0; }
          40%, 100% { opacity: 1; }
        }
      `}</style>
    </span>
  )
}

export default function Error({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="flex items-center gap-3 mb-6">
        <svg className="w-8 h-8 text-gray-900" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
        </svg>
        <h1 className="font-body text-2xl font-black text-gray-900">
          Work in progress<AnimatedDots />
        </h1>
      </div>

      <p className="text-gray-400 text-sm max-w-xs mb-8">
        Nuestro equipo aun esta trabajando en esto. Vuelve pronto.
      </p>
      <Link
        href="/"
        className="pressable bg-brand-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
