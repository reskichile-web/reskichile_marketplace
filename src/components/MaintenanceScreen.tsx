import Image from 'next/image'
import { AlertTriangle } from 'lucide-react'

export default function MaintenanceScreen() {
  return (
    <main className="fixed inset-0 isolate h-[100svh] overflow-hidden bg-gray-900 font-body text-gray-900">
      <Image
        src="/maintenance-andes-8k.webp"
        alt="Cordillera de los Andes cubierta de nieve"
        fill
        priority
        fetchPriority="high"
        sizes="100vw"
        className="object-cover object-center"
      />

      <div aria-hidden="true" className="absolute inset-0 bg-white/45" />

      <section
        role="status"
        aria-live="polite"
        className="relative z-10 flex h-full w-full items-center justify-center p-4"
      >
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 text-center shadow-xl sm:p-8">
          <img
            src="/logo.svg"
            alt="ReskiChile"
            className="mx-auto h-10 w-auto"
          />

          <h1 className="mt-5 text-xl font-bold text-gray-900 sm:text-2xl">
            Interrupción temporal del servicio
          </h1>

          <p className="mt-2 text-sm font-normal leading-relaxed text-gray-500">
            Estamos experimentando una incidencia en nuestro proveedor de infraestructura, que impide cargar temporalmente el catálogo y algunas funciones del sitio.
          </p>

          <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" strokeWidth={1.8} aria-hidden="true" />
            <div className="text-left">
              <p className="text-[11px] font-medium text-amber-800">Estamos trabajando en ello</p>
              <p className="text-xs leading-relaxed text-amber-700">Volveremos a habilitar ReskiChile cuando los servicios estén estables.</p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs font-medium text-gray-500">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-400 opacity-50 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-brand-500" />
            </span>
            Restableciendo servicios
          </div>
        </div>
      </section>
    </main>
  )
}
