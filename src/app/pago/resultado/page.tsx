'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function PaymentResultPage() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')

  const messages: Record<string, { title: string; desc: string; color: string }> = {
    approved: {
      title: 'Pago exitoso',
      desc: 'Tu producto ha sido enviado para revisión. Te notificaremos cuando sea aprobado.',
      color: 'text-green-600',
    },
    rejected: {
      title: 'Pago rechazado',
      desc: 'El pago fue rechazado por Webpay. Intenta nuevamente o usa otro medio de pago.',
      color: 'text-red-600',
    },
    cancelled: {
      title: 'Pago cancelado',
      desc: 'Cancelaste el proceso de pago. Tu producto queda guardado como borrador.',
      color: 'text-yellow-600',
    },
    error: {
      title: 'Error en el pago',
      desc: 'Ocurrió un error procesando el pago. Intenta nuevamente.',
      color: 'text-red-600',
    },
  }

  const msg = messages[status || ''] || messages.error

  return (
    <div className="max-w-md mx-auto mt-16 px-4 text-center">
      <h1 className={`text-2xl font-bold mb-4 ${msg.color}`}>{msg.title}</h1>
      <p className="text-gray-600 mb-8">{msg.desc}</p>
      <div className="flex gap-4 justify-center">
        <Link
          href="/mis-productos"
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          Mis productos
        </Link>
        <Link
          href="/"
          className="border px-6 py-2 rounded hover:bg-gray-50"
        >
          Inicio
        </Link>
      </div>
    </div>
  )
}
