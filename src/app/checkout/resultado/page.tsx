import Link from 'next/link'
import { cookies } from 'next/headers'
import { getPaymentCallbackConfig } from '@/lib/env/server'
import { paymentAccessCookieName } from '@/lib/commerce/checkout-service'
import { getGuestOrder } from '@/lib/commerce/order-service'
import CheckoutResultCard from '@/components/checkout/CheckoutResultCard'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ orden?: string; acceso?: string }>
}

export default async function CheckoutResultPage({ searchParams }: Props) {
  const { orden: publicId = '', acceso } = await searchParams
  // Existing buyers must be able to see a result even if checkout is disabled
  // or a shipping-only variable is temporarily invalid.
  const config = getPaymentCallbackConfig()
  const cookieStore = await cookies()
  const accessCookie = cookieStore.get(paymentAccessCookieName(config))?.value
  const order = publicId
    ? await getGuestOrder(publicId, accessCookie, acceso, config)
    : null

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

  return <CheckoutResultCard order={order} />
}
