import Link from 'next/link'
import { Check } from 'lucide-react'
import type { GuestOrderResult } from '@/lib/commerce/order-service'
import ClearSkiRackCart from '@/components/checkout/ClearSkiRackCart'
import CopyOrderNumberButton from '@/components/checkout/CopyOrderNumberButton'
import PaymentStatusRefresh from '@/components/checkout/PaymentStatusRefresh'

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
      description: 'Te informaremos por correo sobre el estado de tu pedido.',
      tone: 'text-brand-400',
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

function fulfillmentStep(status: string): 1 | 2 | 3 {
  if (['shipped', 'delivered'].includes(status)) return 3
  if (['preparing', 'ready_for_pickup'].includes(status)) return 2
  return 1
}

function OrderTimeline({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  const steps = ['Orden creada', 'Despacho', 'Envío']

  return (
    <ol aria-label="Estado del pedido" className="mt-8 grid grid-cols-3">
      {steps.map((step, index) => {
        const stepNumber = (index + 1) as 1 | 2 | 3
        const completed = currentStep > stepNumber
        const active = currentStep === stepNumber

        return (
          <li key={step} aria-current={active ? 'step' : undefined} className="relative flex min-w-0 flex-col items-center text-center">
            {index > 0 && (
              <span
                aria-hidden="true"
                className={`absolute left-0 right-1/2 top-3 h-px ${currentStep >= stepNumber ? 'bg-brand-400' : 'bg-gray-200'}`}
              />
            )}
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute left-1/2 right-0 top-3 h-px ${currentStep > stepNumber ? 'bg-brand-400' : 'bg-gray-200'}`}
              />
            )}
            <span
              className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold ${
                active || completed
                  ? 'border-brand-400 bg-brand-400 text-white'
                  : 'border-gray-200 bg-white text-gray-400'
              }`}
            >
              {completed ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" /> : stepNumber}
            </span>
            <span className={`mt-2 text-[10px] font-semibold sm:text-xs ${active || completed ? 'text-gray-900' : 'text-gray-400'}`}>
              {step}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default function CheckoutResultCard({ order }: { order: GuestOrderResult }) {
  const copy = statusCopy(order.paymentStatus)
  const homeAddress = order.delivery.formattedAddress ||
    [order.delivery.street, order.delivery.number].filter(Boolean).join(' ')
  const destination = [order.delivery.commune, order.delivery.region]
    .filter(Boolean)
    .join(', ')
  const deliveryAddressLines = order.delivery.method === 'pickup'
    ? [order.delivery.pickupPointId, order.delivery.extra, destination].filter(Boolean)
    : [homeAddress, order.delivery.extra, order.delivery.formattedAddress ? '' : destination].filter(Boolean)

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <section className="border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        {order.paymentStatus === 'authorized' && order.containsRackItems && (
          <ClearSkiRackCart />
        )}
        <div className="flex flex-wrap items-center gap-x-1 text-xs font-bold uppercase tracking-[0.18em]">
          <span className="text-gray-400">Orden</span>
          <span className="text-gray-950">{order.orderNumber}</span>
          <CopyOrderNumberButton orderNumber={order.orderNumber} />
        </div>
        <h1 className={'mt-3 font-body text-3xl font-black ' + copy.tone}>
          {copy.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">{copy.description}</p>
        <PaymentStatusRefresh
          active={['pending', 'processing', 'reconciliation_required'].includes(
            order.paymentStatus
          )}
        />

        {order.paymentStatus === 'authorized' && (
          <OrderTimeline currentStep={fulfillmentStep(order.fulfillmentStatus)} />
        )}

        <section aria-labelledby="shipping-details-title" className="mt-8 border-t border-gray-100 pt-6">
          <h2 id="shipping-details-title" className="font-body text-base font-black text-gray-900">
            Datos de envío
          </h2>
          <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Destinatario</dt>
              <dd className="mt-1 font-semibold text-gray-900">{order.buyer.name}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Teléfono</dt>
              <dd className="mt-1 text-gray-700">{order.buyer.phone}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Correo</dt>
              <dd className="mt-1 break-words text-gray-700">{order.buyer.email}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
                {order.delivery.method === 'pickup' ? 'Punto de retiro' : 'Dirección de entrega'}
              </dt>
              <dd className="mt-1 font-semibold leading-6 text-gray-900">
                {deliveryAddressLines.map((line, index) => <span key={`${line}-${index}`} className="block">{line}</span>)}
              </dd>
            </div>
          </dl>
        </section>

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
