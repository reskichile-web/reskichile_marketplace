import type { SkiRackStockAdjustment } from '@/lib/ski-rack-cart'
import { getSkiRackProduct } from '@/lib/ski-rack-products'

export default function SkiRackStockNotice({ changes }: { changes: SkiRackStockAdjustment[] }) {
  if (changes.length === 0) return null
  return (
    <div role="status" className="my-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">Actualizamos tu carrito al stock disponible.</p>
      <ul className="mt-1 space-y-1">
        {changes.map(item => (
          <li key={`${item.slug}:${item.size}`}>
            {getSkiRackProduct(item.slug)?.name} · Talla {item.size}:{' '}
            {item.quantity > 0
              ? `${item.quantity} ${item.quantity === 1 ? 'unidad disponible' : 'unidades disponibles'}`
              : 'agotado, retirado del carrito'}.
          </li>
        ))}
      </ul>
    </div>
  )
}
