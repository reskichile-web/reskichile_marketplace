import Link from 'next/link'
import { cookies } from 'next/headers'
import { getPaymentCallbackConfig } from '@/lib/env/server'
import { paymentAccessCookieName } from '@/lib/commerce/checkout-service'
import { getGuestOrder } from '@/lib/commerce/order-service'
import PaymentStatusRefresh from '@/components/checkout/PaymentStatusRefresh'
import ClearSkiRackCart from '@/components/checkout/ClearSkiRackCart'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ orden?: string }>
}

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

function statusCopy(status: string): {
  title: string
  description: string
  tone: string
} {
  if (status === 'authorized') {
    return {
      title: 'Pago confirmado',
      description: 'Recibimos tu compra. Ahora comenzaremos a preparar el despacho.',
      tone: 'text-emerald-700',
    }
  }
  if (status === 'rejected') {
    return {
      title: 'Pago rechazado',
      description: 'Webpay no autorizó el pago. No se confirmó la compra.',
      tone: 'text-red-700',
    }
  }
  if (status === 'aborted') {
    return {
      title: 'Pago cancelado',
      description: 'Cancelaste el proceso en Webpay. No se confirmó la compra.',
      tone: 'text-amber-700',
    }
  }
  if (status === 'expired') {
    return {
      title: 'Sesión expirada',
      description: 'El tiempo para completar el pago terminó. No se confirmó la compra.',
      tone: 'text-amber-700',
    }
  }
  if (status === 'reconciliation_required') {
    return {
      title: 'Estamos verificando tu pago',
      description: 'No intentes pagar otra vez. Revisaremos el resultado con Transbank antes de continuar.',
      tone: 'text-amber-700',
    }
  }
  return {
    title: 'Pago en proceso',
    description: 'Todavía estamos verificando la respuesta de Webpay. No repitas el pago.',
    tone: 'text-sky-700',
  }
}

export default async function CheckoutResultPage({ searchParams }: Props) {
  const { orden: publicId = '' } = await searchParams
  // Existing buyers must be able to see a result even if checkout is disabled
  // or a shipping-only variable is temporarily invalid.
  const config = getPaymentCallbackConfig()
  const cookieStore = await cookies()
  const accessCookie = cookieStore.get(paymentAccessCookieName(config))?.value
  const order = publicId ? await getGuestOrder(publicId, accessCookie) : null

  if (!order) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-body text-3xl font-black text-gray-900">
          No pudimos mostrar el detalle
        </h1>
        <p className="mt-4 text-sm leading-6 text-gray-600">
          Si acabas de volver desde Webpay, no repitas el pago. Escríbenos para verificarlo de forma segura.
        </p>
        <Link href="/catalogo" className="mt-8 inline-flex bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600">
          Volver al catálogo
        </Link>
      </main>
    )
  }

  const copy = statusCopy(order.paymentStatus)

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <section className="border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        {order.paymentStatus === 'authorized' && order.containsRackItems && (
          <ClearSkiRackCart />
        )}
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
          Orden {order.orderNumber}
        </p>
        <h1 className={'mt-3 font-body text-3xl font-black ' + copy.tone}>
          {copy.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">{copy.description}</p>
        <PaymentStatusRefresh
          active={['pending', 'processing', 'reconciliation_required'].includes(
            order.paymentStatus
          )}
        />

        <div className="mt-8 space-y-3 border-t border-gray-100 pt-6 text-sm">
          {order.items.map((item) => (
            <div key={item.name} className="flex justify-between gap-4">
              <span className="text-gray-700">{item.name}</span>
              <span className="font-semibold">{money.format(item.priceClp)}</span>
            </div>
          ))}
          {order.discountClp > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Descuento</span>
              <span>-{money.format(order.discountClp)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <span>Despacho</span>
            <span>{money.format(order.shippingClp)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-3 text-base font-black">
            <span>Total</span>
            <span>{money.format(order.totalClp)}</span>
          </div>
        </div>

        <Link href="/catalogo" className="mt-8 flex w-full items-center justify-center bg-gray-900 px-6 py-3 font-semibold text-white hover:bg-gray-800">
          Volver al catálogo
        </Link>
      </section>
    </main>
  )
}
