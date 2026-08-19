'use client'

import Link from 'next/link'
import CheckoutForm, { type CheckoutItemSummary } from '@/components/checkout/CheckoutForm'
import { useSkiRackCart } from '@/lib/ski-rack-cart'
import { getSkiRackProduct, getSkiRackSizeImage } from '@/lib/ski-rack-products'
import { variantAvailability } from '@/lib/rack-inventory'
import { useRackInventory } from '@/lib/use-rack-inventory'

export default function SkiRackCheckout({ enabled, sandbox, addressValidationEnabled }: { enabled: boolean; sandbox: boolean; addressValidationEnabled: boolean }) {
  const { items: cartItems, ready } = useSkiRackCart()
  const { inventory, loading, error } = useRackInventory()

  if (!ready || loading) {
    return <main className="mx-auto min-h-[520px] max-w-5xl px-4 py-10" />
  }

  const lines = cartItems.flatMap((item): CheckoutItemSummary[] => {
    const product = getSkiRackProduct(item.slug)
    const inventoryProduct = inventory[item.slug]
    const variant = inventoryProduct?.variants.find(candidate => candidate.size === item.size)
    if (!product || !variant) return []
    return [{
      id: `${item.slug}:${item.size}`,
      slug: item.slug,
      name: product.name,
      priceClp: inventoryProduct.priceClp,
      quantity: item.quantity,
      selectedSize: item.size,
      backHref: '/carrito',
      imageUrl: getSkiRackSizeImage(product, item.size).url,
    }]
  })

  if (cartItems.length === 0 || lines.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-body text-3xl font-black">Tu carrito está vacío</h1>
        <p className="mt-3 text-sm text-gray-500">Agrega un Ski Rack antes de continuar.</p>
        <Link href="/ski-rack" className="mt-7 inline-flex bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600">
          Ver Ski Racks
        </Link>
      </main>
    )
  }

  const unavailable = cartItems.some(item => (
    variantAvailability(inventory[item.slug], item.size) < item.quantity
  ))
  const checkoutEnabled = enabled && !error && !unavailable
  const unavailableMessage = error
    ? 'No pudimos confirmar el inventario. Intenta nuevamente en unos minutos.'
    : unavailable
      ? 'El stock cambió. Vuelve al carrito y ajusta las cantidades antes de pagar.'
      : !enabled
        ? 'Los pagos están temporalmente deshabilitados.'
        : undefined

  return (
    <CheckoutForm
      items={lines}
      kind="racks"
      enabled={checkoutEnabled}
      sandbox={sandbox}
      addressValidationEnabled={addressValidationEnabled}
      unavailableMessage={unavailableMessage}
    />
  )
}
