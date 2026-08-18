import { loadActionToken } from '@/lib/action-token'
import ActionTokenPage from '@/components/ActionTokenPage'
import InvalidTokenNotice from '@/components/InvalidTokenNotice'

export const dynamic = 'force-dynamic'

export default async function ConfirmSoldPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ alt?: string }>
}) {
  const [{ token }, query] = await Promise.all([params, searchParams])
  const view = await loadActionToken(token, 'confirm_sold')
  if (view.state !== 'valid' || !view.product) return <InvalidTokenNotice state={view.state} />
  if (view.product.status === 'sold') return <InvalidTokenNotice state="used" />

  // Sibling token → "No, sigue disponible" page (round-trips back here via ?alt).
  const alt = query.alt
  const altProps = alt
    ? { altHref: `/p/disponible/${alt}?alt=${token}`, altLabel: 'No, sigue disponible' }
    : {}

  return (
    <ActionTokenPage
      token={token}
      endpoint="/api/products/sold/confirm"
      product={view.product}
      title="¡Felicitaciones por tu venta!"
      subtitle="Cuéntanos un poco para mejorar las referencias de mercado (todo opcional)."
      buttonLabel="Marcar como vendido"
      buttonTone="green"
      successTitle="¡Listo!"
      successBody="Registramos tu venta. ¡Gracias por vender en ReSkiChile!"
      withSaleForm
      {...altProps}
    />
  )
}
