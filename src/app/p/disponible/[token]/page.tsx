import { loadActionToken } from '@/lib/action-token'
import ActionTokenPage from '@/components/ActionTokenPage'
import InvalidTokenNotice from '@/components/InvalidTokenNotice'

export const dynamic = 'force-dynamic'

export default async function StillAvailablePage({
  params,
  searchParams,
}: {
  params: { token: string }
  searchParams: { alt?: string }
}) {
  const view = await loadActionToken(params.token, 'still_available')
  if (view.state !== 'valid' || !view.product) return <InvalidTokenNotice state={view.state} />

  // Sibling token → "Sí, ya la vendí" page (round-trips back here via ?alt).
  const alt = searchParams.alt
  const altProps = alt
    ? { altHref: `/p/vendi/${alt}?alt=${params.token}`, altLabel: 'Sí, ya la vendí' }
    : {}

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
      {...altProps}
    />
  )
}
