'use client'

import { useEffect, useState } from 'react'
import { skiRackOfferTimeRemaining } from '@/lib/ski-rack-offer'

export default function OfferCountdown({ compact = false }: { compact?: boolean }) {
  const [remaining, setRemaining] = useState<ReturnType<typeof skiRackOfferTimeRemaining> | null>(null)
  useEffect(() => {
    const update = () => setRemaining(skiRackOfferTimeRemaining(Date.now()))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [])

  if (remaining?.totalMs === 0) return <span className="text-sm font-semibold">Oferta finalizada</span>
  const values = [remaining?.days, remaining?.hours, remaining?.minutes, remaining?.seconds]
    .map(value => value == null ? '—' : String(value).padStart(2, '0'))
  if (compact) return <span className="font-bold text-brand-400 tabular-nums">{values[0]}d {values[1]}h {values[2]}m {values[3]}s</span>
  return (
    <div className="mx-auto mt-4 grid max-w-[270px] grid-cols-4 gap-4 text-center" role="timer" aria-label="Tiempo restante de la oferta">
      {['Días', 'Horas', 'Min', 'Seg'].map((label, index) => (
        <div key={label}>
          <span className="block font-nav text-[30px] font-light leading-none tracking-tight text-brand-400 tabular-nums sm:text-[36px]">{values[index]}</span>
          <span className="mt-2 block text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</span>
        </div>
      ))}
    </div>
  )
}
