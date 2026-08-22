'use client'

import Image from 'next/image'
import Link from 'next/link'
import { MousePointerClick } from 'lucide-react'
import { SKI_RACK_PRODUCTS, type SkiRackProduct } from '@/lib/ski-rack-products'
import { totalRackAvailability } from '@/lib/rack-inventory'
import { useRackInventory } from '@/lib/use-rack-inventory'

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

export default function SkiRackRelatedProducts({ currentProduct }: { currentProduct: SkiRackProduct }) {
  const { inventory, loading } = useRackInventory()
  const relatedProducts = SKI_RACK_PRODUCTS.filter((product) => (
    product.slug === 'filamento' && product.slug !== currentProduct.slug
  ))

  if (relatedProducts.length === 0) return null

  return (
    <section className="mt-12 border-t border-gray-100 px-4 pt-8 md:mt-16 md:px-0 md:pt-10" aria-labelledby="related-racks-title">
      <div className="mb-5 flex items-center justify-between">
        <h2 id="related-racks-title" className="font-body text-xl font-black text-gray-950 md:text-2xl">
          También te puede gustar
        </h2>
        <Link href="/ski-rack" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-500 hover:text-brand-600">
          Ver todos
          <MousePointerClick className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid max-w-[240px] grid-cols-1">
        {relatedProducts.map((product) => {
          const productInventory = inventory[product.slug]
          const priceClp = productInventory?.priceClp ?? product.priceClp
          const soldOut = !loading && totalRackAvailability(productInventory) === 0

          return (
            <article key={product.slug} className="group min-w-0">
              <Link href={`/ski-rack/${product.slug}`} className="block">
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-gray-50">
                  <Image
                    src={product.image}
                    alt={product.imageAlt}
                    fill
                    sizes="240px"
                    className={`object-cover transition-transform duration-500 group-hover:scale-[1.035] ${soldOut ? 'grayscale opacity-65' : ''} ${product.imageClassName}`}
                  />
                  {soldOut && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/35">
                      <span className="rounded-full bg-gray-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white">
                        Sin stock
                      </span>
                    </div>
                  )}
                </div>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {product.material}
                </p>
                <h3 className="mt-1 font-body text-sm font-semibold text-gray-950 transition-colors group-hover:text-brand-500">
                  {product.name}
                </h3>
                <p className="mt-0.5 font-body text-sm font-bold text-gray-950">
                  {money.format(priceClp)}
                </p>
              </Link>
            </article>
          )
        })}
      </div>
    </section>
  )
}
