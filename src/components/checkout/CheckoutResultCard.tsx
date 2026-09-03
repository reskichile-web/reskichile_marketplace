import Link from 'next/link'
import { AlertTriangle, Check, Clock3, LoaderCircle, XCircle } from 'lucide-react'
import type { GuestOrderResult } from '@/lib/commerce/order-service'
import ClearSkiRackCart from '@/components/checkout/ClearSkiRackCart'
import CopyOrderNumberButton from '@/components/checkout/CopyOrderNumberButton'
import PaymentStatusRefresh from '@/components/checkout/PaymentStatusRefresh'

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

const orderDate = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Santiago',
})

function statusCopy(status: string): {
  title: string
  description: string
  tone: string
} {
  if (status === 'authorized') {
    return {
      title: 'Tu orden fue confirmada',
      description: 'Te mantendremos al tanto por correo.',
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

function OrderTimeline({
  currentStep,
  pickup,
}: {
  currentStep: 1 | 2 | 3
  pickup: boolean
}) {
  const steps = pickup
    ? ['Confirmada', 'Preparación', 'Lista para retirar']
    : ['Confirmada', 'Preparación', 'En camino']

  return (
    <ol aria-label="Estado del pedido" className="mt-6 grid grid-cols-3">
      {steps.map((step, index) => {
        const stepNumber = (index + 1) as 1 | 2 | 3
        const completed = currentStep > stepNumber
        const active = currentStep === stepNumber

        return (
          <li key={step} aria-current={active ? 'step' : undefined} className="relative flex min-w-0 flex-col items-center text-center">
            {index > 0 && (
              <span
                aria-hidden="true"
                className={`absolute left-0 right-1/2 top-[18px] h-0.5 ${currentStep >= stepNumber ? 'bg-brand-400' : 'bg-gray-200'}`}
              />
            )}
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute left-1/2 right-0 top-[18px] h-0.5 ${currentStep > stepNumber ? 'bg-brand-400' : 'bg-gray-200'}`}
              />
            )}
            <span
              className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold ${
                active || completed
                  ? 'border-brand-400 bg-brand-400 text-white'
                  : 'border-gray-200 bg-white text-gray-400'
              }`}
            >
              {completed ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /> : stepNumber}
            </span>
            <span className={`mt-3 text-[11px] font-semibold sm:text-sm ${active || completed ? 'text-gray-900' : 'text-gray-400'}`}>
              {step}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function CompactPaymentResult({ order }: { order: GuestOrderResult }) {
  const copy = statusCopy(order.paymentStatus)
  const active = ['pending', 'processing', 'reconciliation_required'].includes(
    order.paymentStatus
  )
  const terminal = ['rejected', 'aborted', 'expired'].includes(order.paymentStatus)

  const StatusIcon = order.paymentStatus === 'rejected'
    ? XCircle
    : order.paymentStatus === 'aborted'
      ? AlertTriangle
      : order.paymentStatus === 'expired'
        ? Clock3
        : LoaderCircle

  return (
    <main className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-12">
      <section className="w-full max-w-md border border-gray-200 bg-white px-6 py-10 text-center shadow-sm sm:px-10 sm:py-12">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 ${copy.tone}`}>
          <StatusIcon
            className={`h-7 w-7 ${active ? 'animate-spin' : ''}`}
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>

        <h1 className={`mt-5 font-body text-3xl font-black ${copy.tone}`}>
          {copy.title}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-gray-600">
          {copy.description}
        </p>
        <PaymentStatusRefresh active={active} />

        <div className="mt-7 flex items-center justify-center gap-x-1 text-[10px] font-bold uppercase tracking-[0.16em]">
          <span className="text-gray-400">Orden</span>
          <span className="text-gray-700">{order.orderNumber}</span>
          <CopyOrderNumberButton orderNumber={order.orderNumber} />
        </div>

        {terminal && (
          <Link
            href="/carrito"
            className="mt-8 flex w-full items-center justify-center bg-gray-900 px-6 py-3 font-semibold text-white hover:bg-gray-800"
          >
            Volver al carrito
          </Link>
        )}
      </section>
    </main>
  )
}

export default function CheckoutResultCard({ order }: { order: GuestOrderResult }) {
  if (order.paymentStatus !== 'authorized') {
    return <CompactPaymentResult order={order} />
  }

  const copy = statusCopy(order.paymentStatus)
  const homeAddress = order.delivery.formattedAddress ||
    [order.delivery.street, order.delivery.number].filter(Boolean).join(' ')
  const destination = [order.delivery.commune, order.delivery.region]
    .filter(Boolean)
    .join(', ')
  const deliveryAddressLines = order.delivery.method === 'pickup'
    ? [
        order.delivery.pickupPointId === 'las_condes'
          ? 'Retiro en Las Condes'
          : order.delivery.pickupPointId === 'los_angeles'
            ? 'Retiro en Los Ángeles'
            : order.delivery.pickupPointId,
        destination,
      ].filter(Boolean)
    : [homeAddress, order.delivery.extra, order.delivery.formattedAddress ? '' : destination].filter(Boolean)
  const pickup = order.delivery.method === 'pickup'
  const confirmationMessage = pickup
    ? 'Te contactaremos por correo para coordinar el horario y el punto exacto de retiro.'
    : 'Te avisaremos por correo cuando preparemos tu pedido y cuando vaya en camino.'
  const backHref = order.containsRackItems ? '/ski-rack' : '/catalogo'

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <section className="border border-gray-200 bg-white">
        {order.containsRackItems && (
          <ClearSkiRackCart />
        )}
        <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
          <div className="p-6 sm:p-8 lg:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">
              Pago confirmado
            </p>
            <h1 className={'mt-3 max-w-xl font-body text-3xl font-black sm:text-4xl ' + copy.tone}>
              {copy.title}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-gray-600 sm:text-base">
              {confirmationMessage}
            </p>

            <section aria-labelledby="shipping-details-title" className="mt-10 border-t border-gray-100 pt-8">
              <h2 id="shipping-details-title" className="font-body text-lg font-black text-gray-900">
                {pickup ? 'Detalle del retiro' : 'Detalle de entrega'}
              </h2>
              <dl className="mt-6 grid gap-x-8 gap-y-5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Destinatario</dt>
                  <dd className="mt-1.5 font-semibold text-gray-900">{order.buyer.name}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Teléfono</dt>
                  <dd className="mt-1.5 text-gray-700">{order.buyer.phone}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Correo</dt>
                  <dd className="mt-1.5 break-words text-gray-700">{order.buyer.email}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
                    {pickup ? 'Punto de retiro' : 'Dirección de entrega'}
                  </dt>
                  <dd className="mt-1.5 font-semibold leading-6 text-gray-900">
                    {deliveryAddressLines.map((line, index) => <span key={`${line}-${index}`} className="block">{line}</span>)}
                  </dd>
                </div>
              </dl>
            </section>

            <Link href={backHref} className="mt-10 inline-flex items-center justify-center bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800">
              Volver a la tienda
            </Link>
          </div>

          <aside className="border-t border-gray-200 bg-gray-50 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
            <h2 className="font-body text-lg font-black text-gray-900">Estado de tu pedido</h2>
            <OrderTimeline
              currentStep={fulfillmentStep(order.fulfillmentStatus)}
              pickup={pickup}
            />

            <div className="relative mt-10 border border-dashed border-gray-300 bg-white px-5 py-6 font-mono text-sm shadow-[0_12px_30px_rgba(15,23,42,0.06)] sm:px-7 sm:py-8">
              <span aria-hidden="true" className="absolute -left-2 top-8 h-4 w-4 rounded-full border-r border-gray-300 bg-gray-50" />
              <span aria-hidden="true" className="absolute -right-2 top-8 h-4 w-4 rounded-full border-l border-gray-300 bg-gray-50" />
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-gray-500">
                Comprobante de compra
              </p>
              <div className="mt-5 border-y border-dashed border-gray-200 py-4">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-xs uppercase text-gray-500">Orden</span>
                  <span className="flex min-w-0 items-center gap-1 font-bold text-gray-950">
                    <span className="truncate">{order.orderNumber}</span>
                    <CopyOrderNumberButton orderNumber={order.orderNumber} />
                  </span>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span className="text-xs uppercase text-gray-500">Fecha</span>
                  <span className="text-right text-gray-800">{orderDate.format(new Date(order.createdAt))}</span>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span className="text-xs uppercase text-gray-500">Pago</span>
                  <span className="font-bold text-emerald-700">Webpay · Confirmado</span>
                </div>
              </div>

              <div className="space-y-3 py-5">
                {order.items.map((item) => (
                  <div key={item.name} className="flex justify-between gap-4">
                    <span className="text-gray-700">{item.name}</span>
                    <span className="whitespace-nowrap font-semibold">{money.format(item.priceClp)}</span>
                  </div>
                ))}
                {order.discountClp > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Descuento</span>
                    <span>-{money.format(order.discountClp)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>{pickup ? 'Retiro' : 'Despacho'}</span>
                  <span>{order.shippingClp === 0 ? 'Gratis' : money.format(order.shippingClp)}</span>
                </div>
              </div>

              <div className="flex justify-between border-t border-dashed border-gray-300 pt-5 text-base font-black">
                <span>Total</span>
                <span>{money.format(order.totalClp)}</span>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
