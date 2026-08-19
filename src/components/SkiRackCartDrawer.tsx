'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { EASE_OUT_EXPO } from '@/lib/animations'
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

export default function SkiRackCartDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const { items, ready, itemCount, setQuantity, removeItem } = useSkiRackCart()
  const { inventory, loading: inventoryLoading, error: inventoryError } = useRackInventory()

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose, open])

  const lines = items.flatMap((item) => {
    const product = getSkiRackProduct(item.slug)
    if (!product) return []
    const inventoryProduct = inventory[item.slug]
    return [{
      ...item,
      product,
      priceClp: inventoryProduct?.priceClp ?? product.priceClp,
      available: variantAvailability(inventoryProduct, item.size),
    }]
  })
  const subtotal = lines.reduce((total, line) => total + line.priceClp * line.quantity, 0)
  const hasUnavailableItems = !inventoryLoading && lines.some(line => line.quantity > line.available)
  const canCheckout = ready && lines.length > 0 && !inventoryLoading && !inventoryError && !hasUnavailableItems

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Cerrar carrito"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9998] cursor-default bg-gray-950/40 backdrop-blur-[1px]"
            onClick={onClose}
          />

          <motion.aside
            id="ski-rack-cart-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ski-rack-cart-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.32, ease: EASE_OUT_EXPO }}
            className="fixed bottom-0 right-0 top-0 z-[9999] flex w-full max-w-md flex-col bg-white shadow-2xl"
          >
            <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-gray-100 px-5 sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-500">Ski Rack</p>
                <h2 id="ski-rack-cart-title" className="mt-0.5 font-body text-xl font-black">
                  Tu carrito <span className="text-sm font-medium text-gray-400">({itemCount})</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                aria-label="Cerrar carrito"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {!ready ? (
                <div className="space-y-4" aria-label="Cargando carrito">
                  {[0, 1].map(index => (
                    <div key={index} className="flex animate-pulse gap-4">
                      <div className="h-24 w-24 shrink-0 rounded-xl bg-gray-100" />
                      <div className="flex-1 space-y-3 py-2">
                        <div className="h-3 w-2/3 rounded bg-gray-100" />
                        <div className="h-3 w-1/3 rounded bg-gray-100" />
                        <div className="h-8 w-24 rounded bg-gray-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : lines.length === 0 ? (
                <div className="flex min-h-full flex-col items-center justify-center py-16 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                    <ShoppingBag className="h-7 w-7" strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-body text-xl font-black">Tu carrito está vacío</h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-gray-500">
                    Elige tu Ski Rack y la talla que necesitas para comenzar.
                  </p>
                  <Link
                    href="/ski-rack"
                    onClick={onClose}
                    className="pressable mt-6 bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600"
                  >
                    Ver Ski Racks
                  </Link>
                </div>
              ) : (
                <section className="divide-y divide-gray-100" aria-label="Productos del carrito lateral">
                  {lines.map(line => {
                    const image = getSkiRackSizeImage(line.product, line.size)
                    return (
                      <article key={`${line.slug}-${line.size}`} className="flex gap-4 py-5 first:pt-0">
                        <Link
                          href={`/ski-rack/${line.slug}`}
                          onClick={onClose}
                          className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-50"
                        >
                          <Image src={image.url} alt={image.alt} fill sizes="96px" className="object-cover" />
                        </Link>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/ski-rack/${line.slug}`}
                                onClick={onClose}
                                className="block truncate font-body text-sm font-bold hover:text-brand-500"
                              >
                                {line.product.name}
                              </Link>
                              <p className="mt-1 text-xs text-gray-500">Talla {line.size}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(line.slug, line.size)}
                              className="rounded-full p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                              aria-label={`Eliminar ${line.product.name}, talla ${line.size}`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>

                          {!inventoryLoading && line.quantity > line.available && (
                            <p className="mt-1 text-xs font-semibold text-red-600">
                              {line.available === 0 ? 'Talla sin stock' : `Solo ${line.available} disponibles`}
                            </p>
                          )}

                          <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                            <div className="inline-flex h-8 items-center overflow-hidden rounded-lg border border-gray-200">
                              <button
                                type="button"
                                onClick={() => setQuantity(line.slug, line.size, line.quantity - 1)}
                                disabled={line.quantity <= 1}
                                className="flex h-full w-8 items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                                aria-label="Disminuir cantidad"
                              >
                                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                              <span className="flex h-full min-w-8 items-center justify-center border-x border-gray-200 px-1 text-xs font-semibold">
                                {line.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => setQuantity(line.slug, line.size, line.quantity + 1)}
                                disabled={inventoryLoading || line.quantity >= Math.min(MAX_CART_QUANTITY, line.available)}
                                className="flex h-full w-8 items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                                aria-label="Aumentar cantidad"
                              >
                                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                            <p className="font-body text-sm font-black">{money.format(line.priceClp * line.quantity)}</p>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </section>
              )}
            </div>

            {ready && lines.length > 0 && (
              <footer className="shrink-0 border-t border-gray-100 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-8px_24px_rgba(15,23,42,0.04)] sm:px-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Subtotal</p>
                    <p className="mt-0.5 text-xs text-gray-400">Despacho calculado en checkout</p>
                  </div>
                  <p className="font-body text-xl font-black">{money.format(subtotal)}</p>
                </div>

                {(inventoryError || hasUnavailableItems) && (
                  <p className="mt-3 text-xs leading-5 text-red-600">
                    {inventoryError
                      ? 'No pudimos confirmar el inventario. Intenta nuevamente.'
                      : 'Ajusta las variantes sin stock para continuar.'}
                  </p>
                )}

                {canCheckout ? (
                  <Link
                    href="/checkout?racks=1"
                    onClick={onClose}
                    className="pressable mt-5 flex w-full items-center justify-center bg-brand-500 px-5 py-3.5 text-sm font-semibold text-white hover:bg-brand-600"
                  >
                    Continuar al checkout
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-5 w-full cursor-not-allowed bg-gray-200 px-5 py-3.5 text-sm font-semibold text-gray-500"
                  >
                    {inventoryLoading ? 'Revisando stock…' : 'Revisa el stock del carrito'}
                  </button>
                )}

                <Link
                  href="/carrito"
                  onClick={onClose}
                  className="mt-3 flex w-full items-center justify-center border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
                >
                  Ver carrito
                </Link>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
