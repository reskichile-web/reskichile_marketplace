import { loadActionToken } from '@/lib/action-token'
import ActionTokenPage from '@/components/ActionTokenPage'
import InvalidTokenNotice from '@/components/InvalidTokenNotice'

export const dynamic = 'force-dynamic'

export default async function StillAvailablePage({ params }: { params: { token: string } }) {
  const view = await loadActionToken(params.token, 'still_available')
  if (view.state !== 'valid' || !view.product) return <InvalidTokenNotice state={view.state} />

  return (
    <ActionTokenPage
      token={params.token}
      endpoint="/api/products/reminder/still-available"
      product={view.product}
      title="¿Sigue disponible?"
      subtitle="Confírmanos que tu producto sigue a la venta y avisamos a nuestro equipo."
      buttonLabel="Sí, sigue disponible"
      buttonTone="brand"
      successTitle="¡Gracias!"
      successBody="Avisamos a nuestro equipo que tu producto sigue disponible. Te recordaremos más adelante."
    />
  )
}
