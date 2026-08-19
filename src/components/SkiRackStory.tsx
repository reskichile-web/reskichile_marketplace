'use client'

import Image from 'next/image'
import Link from 'next/link'
import { SKI_RACK_PRODUCTS } from '@/lib/ski-rack-products'
import { totalRackAvailability, variantAvailability } from '@/lib/rack-inventory'
import { useRackInventory } from '@/lib/use-rack-inventory'

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

export default function SkiRackStory() {
  const { inventory, loading } = useRackInventory()

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 pb-16 pt-6 md:px-10 md:pb-20 md:pt-10">
      <header className="mb-8 md:mb-10">
        <h1 className="font-body text-4xl font-black tracking-tight text-brand-400 md:text-5xl">
          Ski Rack
        </h1>
        <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-gray-500 md:text-base">
          Ordena, protege y exhibe tu equipo de montaña.
        </p>
      </header>

      <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-4 md:mb-6">
        <p className="text-sm text-gray-500">2 productos</p>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-white px-2.5 py-1.5 shadow-sm md:gap-2 md:px-3 md:py-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-brand-400 md:h-6 md:w-6">
            <svg className="h-full w-full" viewBox="0 0 24 24" aria-hidden="true">
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
          </span>
          <span className="whitespace-nowrap font-body text-[9px] font-bold text-brand-400 sm:text-[10px] md:text-xs">
            Producto original ReskiChile
          </span>
        </div>
      </div>

      <section className="grid max-w-[600px] grid-cols-2 gap-3 md:gap-5" aria-label="Catálogo Ski Rack">
        {SKI_RACK_PRODUCTS.map((product, index) => {
          const productInventory = inventory[product.slug]
          const priceClp = productInventory?.priceClp ?? product.priceClp
          const totalAvailable = totalRackAvailability(productInventory)
          const soldOut = !loading && totalAvailable === 0
          const limited = !soldOut && !loading && productInventory?.variants.some(variant => (
            variantAvailability(productInventory, variant.size) === 0
          ))
          return (
          <article key={product.name} className="group min-w-0">
            <Link href={`/ski-rack/${product.slug}`} className="block">
              <div className="relative aspect-square overflow-hidden rounded-[18px] bg-gray-50 md:rounded-[22px]">
                <Image
                  src={product.image}
                  alt={product.imageAlt}
                  fill
                  sizes="(max-width: 767px) 50vw, 290px"
                  className={`object-cover transition-all duration-500 group-hover:scale-[1.035] ${soldOut ? 'grayscale opacity-65' : ''} ${product.imageClassName}`}
                  priority={index === 0}
                />
                {soldOut && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/35">
                    <span className="rounded-full bg-gray-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
                      Sin stock
                    </span>
                  </div>
                )}
                {limited && (
                  <span className="absolute left-3 top-3 rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-800">
                    Stock limitado
                  </span>
                )}
              </div>
            </Link>
            <div className="mt-3">
              <p className="font-body text-[9px] font-bold uppercase tracking-widest text-gray-400 md:text-[10px]">
                {product.material}
              </p>
              <h2 className="mt-1 truncate font-body text-sm font-semibold md:text-base">
                <Link href={`/ski-rack/${product.slug}`} className="transition-colors hover:text-brand-500">
                  {product.name}
                </Link>
              </h2>
              <p className="mt-0.5 font-body text-sm font-bold text-black md:text-base">
                {money.format(priceClp)}
              </p>
              {!loading && soldOut && (
                <p className="mt-1 text-[10px] font-medium text-gray-400">
                  Todas las tallas agotadas
                </p>
              )}
            </div>
          </article>
          )
        })}
      </section>
    </div>
  )
}
