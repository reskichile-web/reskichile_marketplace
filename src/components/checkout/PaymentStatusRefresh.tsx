'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  active: boolean
}

export default function PaymentStatusRefresh({ active }: Props) {
  const router = useRouter()
  const [automaticFinished, setAutomaticFinished] = useState(false)

  useEffect(() => {
    if (!active) return

    const refresh = window.setInterval(() => router.refresh(), 5000)
    const stop = window.setTimeout(() => {
      window.clearInterval(refresh)
      setAutomaticFinished(true)
    }, 120000)
    return () => {
      window.clearInterval(refresh)
      window.clearTimeout(stop)
    }
  }, [active, router])

  if (!active) return null

  return (
    <div className="mt-3 text-xs text-gray-500" aria-live="polite">
      <p>{automaticFinished
        ? 'La verificación continúa. Puedes actualizar el estado o contactarnos con tu número de pedido.'
        : 'Consultaremos el estado automáticamente durante los próximos dos minutos.'}</p>
      {automaticFinished && (
        <button type="button" onClick={() => router.refresh()} className="mt-3 font-semibold text-brand-600 underline">
          Actualizar estado
        </button>
      )}
    </div>
  )
}
