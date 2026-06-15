import { loadActionToken } from '@/lib/action-token'
import ActionTokenPage from '@/components/ActionTokenPage'
import InvalidTokenNotice from '@/components/InvalidTokenNotice'

export const dynamic = 'force-dynamic'

export default async function ConfirmSoldPage({ params }: { params: { token: string } }) {
  const view = await loadActionToken(params.token, 'confirm_sold')
  if (view.state !== 'valid' || !view.product) return <InvalidTokenNotice state={view.state} />
  if (view.product.status === 'sold') return <InvalidTokenNotice state="used" />

  return (
    <ActionTokenPage
      token={params.token}
      endpoint="/api/products/sold/confirm"
      product={view.product}
      title="¡Felicitaciones por tu venta!"
      subtitle="Cuéntanos un poco para mejorar las referencias de mercado (todo opcional)."
      buttonLabel="Marcar como vendido"
      buttonTone="green"
      successTitle="¡Listo!"
      successBody="Registramos tu venta. ¡Gracias por vender en ReSkiChile!"
      withSaleForm
    />
  )
}
