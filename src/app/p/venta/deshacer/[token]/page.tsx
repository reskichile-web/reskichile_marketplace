import { loadActionToken } from '@/lib/action-token'
import ActionTokenPage from '@/components/ActionTokenPage'
import InvalidTokenNotice from '@/components/InvalidTokenNotice'

export const dynamic = 'force-dynamic'

export default async function UndoSalePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const view = await loadActionToken(token, 'undo_sale')
  if (view.state !== 'valid' || !view.product) return <InvalidTokenNotice state={view.state} />

  // Already reverted out of sold — nothing to undo.
  if (view.product.status !== 'sold') return <InvalidTokenNotice state="used" />

  return (
    <ActionTokenPage
      token={token}
      endpoint="/api/products/sold/undo"
      product={view.product}
      title="Deshacer venta"
      subtitle="Volveremos a publicar este producto en el catálogo."
      buttonLabel="Deshacer venta y volver a publicar"
      buttonTone="gray"
      successTitle="Venta deshecha"
      successBody="Tu producto volvió al catálogo y está disponible nuevamente."
    />
  )
}
