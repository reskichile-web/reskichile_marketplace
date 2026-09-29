'use client'

import { useEffect, useRef, useState } from 'react'
import { Ruler } from 'lucide-react'
import SkiRackGallery from '@/components/SkiRackGallery'
import SkiRackRelatedProducts from '@/components/SkiRackRelatedProducts'
import SkiRackSizeGuide from '@/components/SkiRackSizeGuide'
import { trackMetaAddToCart, trackMetaViewContent } from '@/lib/meta-pixel'
import {
  SKI_RACK_SIZES,
  getSkiRackDescription,
  getSkiRackGalleryForSize,
  type SkiRackProduct,
  type SkiRackSize,
} from '@/lib/ski-rack-products'
import { addSkiRackCartItem, remainingRackCartQuantity, openSkiRackCart, useSkiRackCart } from '@/lib/ski-rack-cart'
import { totalRackAvailability, variantAvailability } from '@/lib/rack-inventory'
import { useRackInventory } from '@/lib/use-rack-inventory'

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

export default function SkiRackProductDetail({ product }: { product: SkiRackProduct }) {
  const viewTracked = useRef(false)
  const [selectedSize, setSelectedSize] = useState<SkiRackSize>('S')
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(0)
  const [adding, setAdding] = useState(false)
  const [stockMessage, setStockMessage] = useState('')
  const addingRef = useRef(false)
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false)
  const { items: cartItems, ready: cartReady } = useSkiRackCart()
  const { inventory, loading: inventoryLoading, error: inventoryError, refresh } = useRackInventory()
  const productInventory = inventory[product.slug]
  const priceClp = productInventory?.priceClp ?? product.priceClp
  const totalAvailable = totalRackAvailability(productInventory)
  const soldOut = !inventoryLoading && !inventoryError && totalAvailable === 0
  const selectedAvailable = variantAvailability(productInventory, selectedSize)
  const quantityLimit = remainingRackCartQuantity(cartItems, product.slug, selectedSize, selectedAvailable)
  const alreadyInCart = cartItems.find(item => item.slug === product.slug && item.size === selectedSize)?.quantity ?? 0
  const cartHasAllAvailable = !inventoryLoading && !inventoryError && selectedAvailable > 0 && quantityLimit === 0

  useEffect(() => {
    if (viewTracked.current || inventoryLoading) return
    viewTracked.current = true
    trackMetaViewContent({
      contentId: `ski-rack:${product.slug}`,
      contentName: product.name,
      category: 'ski_rack',
      value: priceClp,
    })
  }, [inventoryLoading, priceClp, product.name, product.slug])

  useEffect(() => {
    if (inventoryLoading || inventoryError || selectedAvailable > 0) return
    const firstAvailable = SKI_RACK_SIZES.find(size => (
      variantAvailability(productInventory, size) > 0
    ))
    if (firstAvailable) setSelectedSize(firstAvailable)
  }, [inventoryLoading, inventoryError, productInventory, selectedAvailable])

  useEffect(() => {
    if (quantityLimit > 0 && quantity > quantityLimit) setQuantity(quantityLimit)
  }, [quantity, quantityLimit])

  async function handleAddToCart() {
    if (addingRef.current || !cartReady) return
    if (cartHasAllAvailable) { openSkiRackCart(); return }
    if (inventoryLoading) return
    addingRef.current = true
    setAdding(true)
    setAdded(0)
    setStockMessage('')
    try {
      const latest = await refresh()
      if (!latest) return
      const available = variantAvailability(latest[product.slug], selectedSize)
      const addedQuantity = addSkiRackCartItem(product.slug, selectedSize, quantity, available)
      if (addedQuantity === 0) {
        setStockMessage(available === 0
          ? `La talla ${selectedSize} se agotó. Elige otra talla disponible.`
          : 'Ya tienes todas las unidades disponibles de esta talla en tu carrito.')
        if (alreadyInCart > 0) openSkiRackCart()
        return
      }
      const currentPrice = latest[product.slug].priceClp
      trackMetaAddToCart({
        items: [{
          contentId: `ski-rack:${product.slug}`,
          contentName: `${product.name} · Talla ${selectedSize}`,
          category: 'ski_rack',
          value: currentPrice,
          quantity: addedQuantity,
        }],
        value: currentPrice * addedQuantity,
      })
      setAdded(addedQuantity)
      openSkiRackCart()
    } finally {
      addingRef.current = false
      setAdding(false)
    }
  }

  return (
    <div className="-mt-[35px] md:mt-0">
      <div className="mx-auto max-w-4xl pb-16 md:mt-8 md:px-4">
        <div className="grid md:grid-cols-2 md:gap-8">
          <div className="px-4 md:px-0">
            <SkiRackGallery
              key={selectedSize}
              images={getSkiRackGalleryForSize(product, selectedSize)}
              title={product.name}
            />
          </div>

          <div className="mt-4 px-4 md:mt-0 md:px-0">
            <p className="text-sm font-medium text-brand-500">Ski Rack</p>

            <h1 className="mt-1 font-body text-2xl font-black md:text-3xl">
              {product.name}
            </h1>
            {product.previousPriceClp && product.previousPriceClp > priceClp ? (
              <p className="mt-1 flex items-baseline gap-2 font-body">
                <span className="text-sm text-gray-400 line-through">
                  {money.format(product.previousPriceClp)}
                </span>
                <span className="text-2xl font-semibold text-red-600 md:text-3xl">
                  {money.format(priceClp)}
                </span>
                <span className="text-xs font-bold text-red-600">
                  -{Math.round((1 - priceClp / product.previousPriceClp) * 100)}%
                </span>
              </p>
            ) : (
              <p className="mt-1 font-body text-2xl font-semibold text-brand-500 md:text-3xl">
                {money.format(priceClp)}
              </p>
            )}

            {soldOut && (
              <div className="mt-4 inline-flex rounded-full bg-gray-900 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white">
                Sin stock
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 border-y border-gray-100 py-3 text-sm text-gray-700">
              <svg className="h-4 w-4 shrink-0 text-brand-400" viewBox="0 0 24 24" aria-hidden="true">
                <polygon
                  fill="currentColor"
                  points="12,2 14.1,4.18 17,3.34 17.73,6.27 20.66,7 19.82,9.9 22,12 19.82,14.1 20.66,17 17.73,17.73 17,20.66 14.1,19.82 12,22 9.9,19.82 7,20.66 6.27,17.73 3.34,17 4.18,14.1 2,12 4.18,9.9 3.34,7 6.27,6.27 7,3.34 9.9,4.18"
                />
                <path
                  d="m8.15 12.2 2.42 2.42 5.28-5.28"
                  fill="none"
                  stroke="white"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.2"
                />
              </svg>
              <span>Producto original ReskiChile</span>
            </div>

            <div className="mt-4 border-b border-gray-100 pb-5 text-sm leading-relaxed text-gray-600">
              <p>{getSkiRackDescription(product)}</p>
            </div>

            <fieldset className="mt-5">
              <legend className="sr-only">Selecciona la talla</legend>
              <div className="flex w-full items-center justify-between text-sm">
                <p className="font-semibold text-gray-900">
                  Talla{!soldOut && <span className="font-normal text-gray-500">: {selectedSize}</span>}
                </p>
                <button
                  type="button"
                  onClick={() => setSizeGuideOpen(true)}
                  className="inline-flex items-center gap-1.5 font-bold text-brand-400 underline decoration-brand-200 underline-offset-4 transition-colors hover:text-brand-500"
                >
                  <Ruler className="h-4 w-4" aria-hidden="true" />
                  Guía de tallas
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {SKI_RACK_SIZES.map((size) => {
                  const selected = selectedSize === size
                  const available = variantAvailability(productInventory, size)
                  const unavailable = inventoryLoading || available === 0
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setSelectedSize(size)
                        setQuantity(1)
                        setAdded(0)
                        setStockMessage('')
                      }}
                      disabled={adding || unavailable}
                      className={`relative border py-3 text-sm font-semibold transition-colors ${
                        unavailable
                          ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300 line-through'
                          : selected
                          ? 'border-brand-500 bg-brand-500 text-white'
                          : 'border-gray-200 bg-white text-gray-800 hover:border-brand-300 hover:text-brand-500'
                      }`}
                      aria-pressed={selected}
                    >
                      {size}
                      {!inventoryLoading && available === 0 && (
                        <span className="absolute inset-x-0 -bottom-4 text-[9px] font-normal no-underline text-gray-400">
                          Agotada
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <div className="mt-5 flex items-end gap-3">
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900">Cantidad</p>
                <div className="inline-flex h-12 items-center overflow-hidden rounded-lg border border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setQuantity((current) => Math.max(1, current - 1))
                      setAdded(0)
                    }}
                    disabled={adding || quantity <= 1}
                    className="flex h-full w-11 items-center justify-center text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-30"
                    aria-label="Disminuir cantidad"
                  >
                    −
                  </button>
                  <span className="flex h-full min-w-11 items-center justify-center border-x border-gray-200 px-2 text-sm font-semibold">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setQuantity((current) => Math.min(quantityLimit, current + 1))
                      setAdded(0)
                    }}
                    disabled={!cartReady || adding || inventoryLoading || inventoryError || quantityLimit === 0 || quantity >= quantityLimit}
                    className="flex h-full w-11 items-center justify-center text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-30"
                    aria-label="Aumentar cantidad"
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!cartReady || adding || inventoryLoading || (!inventoryError && (soldOut || selectedAvailable === 0))}
                className="pressable flex h-12 flex-1 items-center justify-center bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                {adding ? 'Agregando…' : inventoryError ? 'Reintentar' : soldOut ? 'Sin stock' : cartHasAllAvailable ? 'Ver carrito' : 'Agregar al carrito'}
              </button>
            </div>

            {(added > 0 || soldOut || cartHasAllAvailable || inventoryError || stockMessage) && (
              <div role="status" className="mt-2 min-h-5 text-center text-xs">
                {inventoryError ? (
                  <span className="text-red-600">No pudimos confirmar el stock. Reintenta para agregar tu producto.</span>
                ) : stockMessage ? (
                  <span className="text-amber-700">{stockMessage}</span>
                ) : cartHasAllAvailable ? (
                  <span className="text-brand-500">
                    Ya tienes {alreadyInCart} {alreadyInCart === 1 ? 'unidad' : 'unidades'} de esta talla en tu carrito.
                  </span>
                ) : added > 0 ? (
                  <span className="text-brand-500">
                    {added} {added === 1 ? 'unidad agregada' : 'unidades agregadas'} ·{' '}
                    <button type="button" onClick={openSkiRackCart} className="font-semibold underline underline-offset-2">
                      Ver carrito
                    </button>
                  </span>
                ) : (
                  <span className="text-gray-500">Todas las tallas están agotadas por el momento.</span>
                )}
              </div>
            )}
          </div>
        </div>

        <SkiRackRelatedProducts currentProduct={product} />
      </div>

      <SkiRackSizeGuide open={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} />
    </div>
  )
}
