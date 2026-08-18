'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  active: boolean
}

export default function PaymentStatusRefresh({ active }: Props) {
  const router = useRouter()

  useEffect(() => {
    if (!active) return

    const refresh = window.setInterval(() => router.refresh(), 5000)
    const stop = window.setTimeout(() => window.clearInterval(refresh), 120000)
    return () => {
      window.clearInterval(refresh)
      window.clearTimeout(stop)
    }
  }, [active, router])

  if (!active) return null

  return (
    <p className="mt-3 text-xs text-gray-500" aria-live="polite">
      Esta pantalla se actualizará automáticamente mientras verificamos el pago.
    </p>
  )
}
