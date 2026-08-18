'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import SkiRackGallery from '@/components/SkiRackGallery'
import DescriptionCard from '@/components/DescriptionCard'
import {
  SKI_RACK_DESCRIPTION,
  SKI_RACK_SIZES,
  type SkiRackProduct,
  type SkiRackSize,
} from '@/lib/ski-rack-products'
import { addSkiRackCartItem, MAX_CART_QUANTITY } from '@/lib/ski-rack-cart'
import { totalRackAvailability, variantAvailability } from '@/lib/rack-inventory'
import { useRackInventory } from '@/lib/use-rack-inventory'

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

export default function SkiRackProductDetail({ product }: { product: SkiRackProduct }) {
  const [selectedSize, setSelectedSize] = useState<SkiRackSize>('M')
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const { inventory, loading: inventoryLoading } = useRackInventory()
  const productInventory = inventory[product.slug]
  const priceClp = productInventory?.priceClp ?? product.priceClp
  const totalAvailable = totalRackAvailability(productInventory)
  const soldOut = !inventoryLoading && totalAvailable === 0
  const selectedAvailable = variantAvailability(productInventory, selectedSize)
  const quantityLimit = Math.min(MAX_CART_QUANTITY, selectedAvailable)

  useEffect(() => {
    if (inventoryLoading || selectedAvailable > 0) return
    const firstAvailable = SKI_RACK_SIZES.find(size => (
      variantAvailability(productInventory, size) > 0
    ))
    if (firstAvailable) setSelectedSize(firstAvailable)
  }, [inventoryLoading, productInventory, selectedAvailable])

  useEffect(() => {
    if (quantityLimit > 0 && quantity > quantityLimit) setQuantity(quantityLimit)
  }, [quantity, quantityLimit])

  function handleAddToCart() {
    if (inventoryLoading || selectedAvailable < quantity) return
    addSkiRackCartItem(product.slug, selectedSize, quantity)
    setAdded(true)
  }

  return (
    <div className="-mt-[35px] md:mt-0">
      <div className="mx-auto max-w-4xl pb-16 md:mt-8 md:px-4">
        <div className="grid md:grid-cols-2 md:gap-8">
          <div className="px-4 md:px-0">
            <SkiRackGallery
              images={product.gallery}
              title={product.name}
            />
          </div>

          <div className="mt-4 px-4 md:mt-0 md:px-0">
            <p className="text-sm font-medium text-brand-500">Ski Rack</p>

            <h1 className="mt-1 font-body text-2xl font-black md:text-3xl">
              {product.name}
            </h1>
            <p className="mt-1 font-body text-2xl font-semibold text-brand-500 md:text-3xl">
              {money.format(priceClp)}
            </p>

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

            <DescriptionCard
              description={SKI_RACK_DESCRIPTION}
              className="mt-4"
              alwaysShowToggle
            />

            <dl className="mt-5 grid grid-cols-2 gap-4 border-b border-gray-100 pb-5 text-sm">
              <div>
                <dt className="text-xs text-gray-400">Material</dt>
                <dd className="mt-1 font-medium text-gray-900">{product.material}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Contenido</dt>
                <dd className="mt-1 font-medium text-gray-900">2 soportes</dd>
              </div>
            </dl>

            <fieldset className="mt-5">
              <legend className="flex w-full items-center justify-between text-sm font-semibold text-gray-900">
                <span>Talla</span>
                {!soldOut && (
                  <span className="text-xs font-normal text-gray-400">Seleccionada: {selectedSize}</span>
                )}
              </legend>
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
                        setAdded(false)
                      }}
                      disabled={unavailable}
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
                      setAdded(false)
                    }}
                    disabled={quantity <= 1}
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
                      setAdded(false)
                    }}
                    disabled={quantityLimit === 0 || quantity >= quantityLimit}
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
                disabled={inventoryLoading || soldOut || selectedAvailable === 0}
                className="pressable flex h-12 flex-1 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                {soldOut ? 'Sin stock' : added ? 'Agregado' : 'Agregar al carrito'}
              </button>
            </div>

            <div className="mt-2 min-h-5 text-center text-xs">
              {added ? (
                <span className="text-brand-500">
                  {quantity} {quantity === 1 ? 'unidad agregada' : 'unidades agregadas'} ·{' '}
                  <Link href="/carrito" className="font-semibold underline underline-offset-2">
                    Ver carrito
                  </Link>
                </span>
              ) : soldOut ? (
                <span className="text-gray-500">Todas las tallas están agotadas por el momento.</span>
              ) : (
                <span className="text-gray-400">Envío y total se confirman en el checkout.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
