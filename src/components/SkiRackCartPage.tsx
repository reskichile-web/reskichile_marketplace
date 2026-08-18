'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  MAX_CART_QUANTITY,
  useSkiRackCart,
} from '@/lib/ski-rack-cart'
import { getSkiRackProduct, getSkiRackSizeImage } from '@/lib/ski-rack-products'
import { variantAvailability } from '@/lib/rack-inventory'
import { useRackInventory } from '@/lib/use-rack-inventory'

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

export default function SkiRackCartPage() {
  const { items, ready, itemCount, setQuantity, removeItem, clearCart } = useSkiRackCart()
  const { inventory, loading: inventoryLoading, error: inventoryError } = useRackInventory()
  const lines = items.flatMap((item) => {
    const product = getSkiRackProduct(item.slug)
    const inventoryProduct = inventory[item.slug]
    return product ? [{
      ...item,
      product,
      priceClp: inventoryProduct?.priceClp ?? product.priceClp,
      available: variantAvailability(inventory[item.slug], item.size),
    }] : []
  })
  const subtotal = lines.reduce((total, line) => total + line.priceClp * line.quantity, 0)
  const hasUnavailableItems = !inventoryLoading && lines.some(line => line.quantity > line.available)

  if (!ready) {
    return <div className="mx-auto min-h-[420px] max-w-5xl px-4 py-10" />
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:py-10">
      <div className="flex items-end justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <p className="text-sm font-medium text-brand-500">Ski Rack</p>
          <h1 className="mt-1 font-body text-3xl font-black">Carrito</h1>
          <p className="mt-1 text-sm text-gray-500">
            {itemCount === 1 ? '1 producto' : `${itemCount} productos`}
          </p>
        </div>
        {lines.length > 0 && (
          <button type="button" onClick={clearCart} className="text-xs font-medium text-gray-400 hover:text-red-500">
            Vaciar carrito
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
          <svg className="h-10 w-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.3} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386a1.5 1.5 0 011.455 1.136L5.4 5.37m0 0h14.35l-1.5 7.5H6.9L5.4 5.37zM8.25 20.25a.75.75 0 100-1.5.75.75 0 000 1.5zm8.25 0a.75.75 0 100-1.5.75.75 0 000 1.5z" />
          </svg>
          <h2 className="mt-4 font-body text-xl font-black">Tu carrito está vacío</h2>
          <p className="mt-2 text-sm text-gray-500">Agrega un Ski Rack para comenzar.</p>
          <Link href="/ski-rack" className="pressable mt-6 bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600">
            Ver catálogo
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
          <section className="space-y-4" aria-label="Productos del carrito">
            {lines.map((line) => (
              <article key={`${line.slug}-${line.size}`} className="flex gap-4 rounded-2xl border border-gray-100 p-3 sm:p-4">
                <Link href={`/ski-rack/${line.slug}`} className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-gray-50 sm:h-32 sm:w-32">
                  <Image
                    src={getSkiRackSizeImage(line.product, line.size).url}
                    alt={getSkiRackSizeImage(line.product, line.size).alt}
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{line.product.material}</p>
                      <Link href={`/ski-rack/${line.slug}`} className="mt-1 block truncate font-body text-sm font-semibold hover:text-brand-500 sm:text-base">
                        {line.product.name}
                      </Link>
                      <p className="mt-1 text-xs text-gray-500">Talla {line.size}</p>
                      {!inventoryLoading && line.quantity > line.available && (
                        <p className="mt-1 text-xs font-semibold text-red-600">
                          {line.available === 0 ? 'Talla sin stock' : `Solo ${line.available} disponibles`}
                        </p>
                      )}
                    </div>
                    <button type="button" onClick={() => removeItem(line.slug, line.size)} className="p-1 text-gray-300 hover:text-red-500" aria-label={`Eliminar ${line.product.name}, talla ${line.size}`}>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5h12m-10.5 0 .6 12h7.8l.6-12M9.75 7.5V4.75h4.5V7.5" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-3">
                    <div className="inline-flex h-9 items-center overflow-hidden rounded-lg border border-gray-200">
                      <button type="button" onClick={() => setQuantity(line.slug, line.size, line.quantity - 1)} disabled={line.quantity <= 1} className="flex h-full w-9 items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30" aria-label="Disminuir cantidad">−</button>
                      <span className="flex h-full min-w-9 items-center justify-center border-x border-gray-200 px-2 text-sm font-semibold">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(line.slug, line.size, line.quantity + 1)}
                        disabled={inventoryLoading || line.quantity >= Math.min(MAX_CART_QUANTITY, line.available)}
                        className="flex h-full w-9 items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                        aria-label="Aumentar cantidad"
                      >
                        +
                      </button>
                    </div>
                    <p className="font-body text-sm font-bold sm:text-base">{money.format(line.priceClp * line.quantity)}</p>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <aside className="h-fit rounded-2xl border border-gray-100 bg-gray-50 p-5 lg:sticky lg:top-36">
            <h2 className="font-body text-lg font-black">Resumen</h2>
            <div className="mt-5 flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span className="font-semibold text-gray-900">{money.format(subtotal)}</span>
            </div>
            <div className="mt-3 flex justify-between text-sm text-gray-600">
              <span>Despacho</span>
              <span>En checkout</span>
            </div>
            <div className="mt-5 flex justify-between border-t border-gray-200 pt-4 font-body text-base font-black">
              <span>Total parcial</span>
              <span>{money.format(subtotal)}</span>
            </div>
            {inventoryLoading || inventoryError || hasUnavailableItems ? (
              <button type="button" disabled className="mt-5 w-full cursor-not-allowed rounded-lg bg-gray-300 px-5 py-3 text-sm font-semibold text-gray-500">
                {inventoryLoading ? 'Revisando stock…' : 'Revisa el stock del carrito'}
              </button>
            ) : (
              <Link href="/checkout?racks=1" className="pressable mt-5 flex w-full items-center justify-center rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-600">
                Continuar al checkout
              </Link>
            )}
            {(inventoryError || hasUnavailableItems) && (
              <p className="mt-3 text-xs leading-5 text-red-600">
                {inventoryError
                  ? 'No pudimos confirmar el inventario. Intenta nuevamente.'
                  : 'Elimina o ajusta las variantes sin stock para continuar.'}
              </p>
            )}
            <Link href="/ski-rack" className="mt-5 block text-center text-sm font-medium text-brand-500 hover:text-brand-600">
              Seguir comprando
            </Link>
          </aside>
        </div>
      )}
    </main>
  )
}
