import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      {/* Mountain illustration */}
      <svg viewBox="0 0 200 120" fill="none" className="w-48 text-gray-300 mb-8">
        <path d="M0 100 L50 35 L75 60 L110 20 L160 55 L200 100 Z" fill="currentColor" opacity={0.08} />
        <path d="M0 100 L50 35 L75 60 L110 20 L160 55 L200 100" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" fill="none" opacity={0.2} />
        <circle cx="170" cy="22" r="8" stroke="currentColor" strokeWidth={1} fill="none" opacity={0.1} />
        {/* 404 text on mountain */}
        <text x="100" y="75" textAnchor="middle" fill="currentColor" opacity={0.15} fontSize="28" fontWeight="900">404</text>
      </svg>

      <h1 className="font-body text-2xl font-black text-gray-900 mb-2">Pagina no encontrada</h1>
      <p className="text-gray-400 text-sm max-w-xs mb-8">
        Esta ruta no existe o fue movida. Puede que el enlace este incorrecto.
      </p>
      <div className="flex gap-3">
        <Link href="/" className="pressable bg-brand-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
          Ir al inicio
        </Link>
        <Link href="/catalogo" className="pressable border border-gray-200 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          Ver catalogo
        </Link>
      </div>
    </div>
  )
}
