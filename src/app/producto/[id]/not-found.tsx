import Link from 'next/link'

function AnimatedDots() {
  return (
    <span className="inline-flex w-6">
      <span style={{ animation: 'dot 1.4s ease-in-out infinite' }}>.</span>
      <span style={{ animation: 'dot 1.4s ease-in-out 0.2s infinite' }}>.</span>
      <span style={{ animation: 'dot 1.4s ease-in-out 0.4s infinite' }}>.</span>
      <style>{`
        @keyframes dot {
          0%, 20% { opacity: 0; }
          40%, 100% { opacity: 1; }
        }
      `}</style>
    </span>
  )
}

export default function ProductNotFound() {
  return (
    <div className="max-w-md mx-auto mt-16 px-4 text-center">
      <div className="flex items-center justify-center gap-3 mb-6">
        <svg className="w-8 h-8 text-gray-900" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
        </svg>
        <h1 className="font-body text-2xl font-black text-gray-900">
          Work in progress<AnimatedDots />
        </h1>
      </div>

      <p className="text-gray-400 text-sm max-w-xs mx-auto mb-8">
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
