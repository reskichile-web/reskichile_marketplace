import Image from 'next/image'
import { AlertTriangle, Clock3, Settings, Wrench } from 'lucide-react'

export default function MaintenanceScreen() {
  return (
    <main className="relative isolate min-h-[100svh] overflow-hidden bg-[#06142a] text-slate-950">
      <Image
        src="/maintenance-andes-8k.webp"
        alt="Cordillera de los Andes cubierta de nieve"
        fill
        priority
        fetchPriority="high"
        sizes="100vw"
        className="object-cover object-center"
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(255,255,255,0.68)_48%,rgba(255,255,255,0.80)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.94)_0%,rgba(255,255,255,0.56)_42%,rgba(7,25,51,0.16)_100%)]"
      />

      <section
        role="status"
        aria-live="polite"
        className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-5xl items-center justify-center px-5 py-8 sm:px-8"
      >
        <div className="w-full max-w-2xl rounded-[2rem] border border-white/80 bg-white/80 px-6 py-8 text-center shadow-[0_30px_90px_rgba(3,18,40,0.24)] backdrop-blur-xl sm:px-12 sm:py-11">
          <div className="mb-6 flex items-center justify-center" aria-hidden="true">
            <div className="relative grid size-24 place-items-center sm:size-28">
              <span className="absolute inset-0 rounded-full border border-[#2674bf]/25 motion-safe:animate-ping" />
              <span className="absolute inset-2 rounded-full bg-[#2674bf]/10" />
              <Settings className="size-16 text-[#2674bf] motion-safe:animate-[spin_7s_linear_infinite] sm:size-[4.5rem]" strokeWidth={1.35} />
              <Wrench className="absolute size-7 text-[#123a66] sm:size-8" strokeWidth={2.1} />
            </div>
          </div>

          <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-amber-900 shadow-sm sm:text-sm">
            <AlertTriangle className="size-4 shrink-0 motion-safe:animate-pulse" aria-hidden="true" />
            Aviso de servicio
          </div>

          <p className="mb-2 font-sub text-sm font-bold uppercase tracking-[0.28em] text-[#2674bf] sm:text-base">
            ReskiChile
          </p>
          <h1 className="font-display text-4xl leading-[0.92] tracking-wide text-[#102a49] sm:text-6xl md:text-7xl">
            MANTENCIÓN
            <span className="block text-[#2674bf]">PROGRAMADA</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base font-medium leading-relaxed text-slate-700 sm:text-lg">
            Estamos trabajando para restablecer nuestros servicios y dejar la montaña lista para ti.
            Mientras realizamos esta mantención, el sitio permanecerá temporalmente fuera de servicio.
          </p>

          <div className="mx-auto mt-7 flex max-w-md items-center justify-center gap-4 rounded-2xl border border-[#2674bf]/20 bg-white/75 px-5 py-4 shadow-sm">
            <Clock3 className="size-8 shrink-0 text-[#2674bf]" aria-hidden="true" />
            <div className="text-left">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Volvemos hoy</p>
              <p className="text-2xl font-black text-[#102a49] sm:text-3xl">
                20:00 <span className="text-base font-bold text-slate-500">hrs</span>
              </p>
              <p className="text-xs font-medium text-slate-500">Hora de Chile</p>
            </div>
          </div>

          <div className="mt-7 flex items-center justify-center gap-3 text-sm font-bold text-[#123a66]">
            <span className="flex items-end gap-1" aria-hidden="true">
              <span className="h-2 w-1 rounded-full bg-[#2674bf] motion-safe:animate-[maintenance-bar_1s_ease-in-out_infinite]" />
              <span className="h-4 w-1 rounded-full bg-[#2674bf] motion-safe:animate-[maintenance-bar_1s_ease-in-out_150ms_infinite]" />
              <span className="h-3 w-1 rounded-full bg-[#2674bf] motion-safe:animate-[maintenance-bar_1s_ease-in-out_300ms_infinite]" />
            </span>
            Restableciendo servicios
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Gracias por tu paciencia y comprensión.
          </p>
        </div>
      </section>
    </main>
  )
}
