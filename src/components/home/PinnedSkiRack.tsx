'use client'

import Image from 'next/image'
import Link from 'next/link'
import { getSkiRackProduct, SKI_RACK_WHITE_WALL_IMAGE } from '@/lib/ski-rack-products'
import { useRackInventory } from '@/lib/use-rack-inventory'
import { totalRackAvailability } from '@/lib/rack-inventory'

export default function PinnedSkiRack() {
  const product = getSkiRackProduct('madera')!
  const { inventory, loading, error } = useRackInventory()
  const stock = inventory.madera
  const soldOut = !loading && !error && totalRackAvailability(stock) === 0
  const price = stock?.priceClp ?? product.priceClp
  return (
    <Link href="/ski-rack/madera" className="group/rack block">
      <div className="relative aspect-[4/5] overflow-hidden bg-white">
        <Image src="/images/ski-rack-madera-white-catalog.webp" alt={product.imageAlt} fill sizes="(max-width: 640px) 45vw, 25vw" className="object-contain transition-opacity duration-300 group-hover/rack:opacity-0 group-focus-visible/rack:opacity-0" />
        <Image src={SKI_RACK_WHITE_WALL_IMAGE.url} alt={SKI_RACK_WHITE_WALL_IMAGE.alt} fill sizes="(max-width: 640px) 45vw, 25vw" className="object-contain object-center opacity-0 transition-opacity duration-300 group-hover/rack:opacity-100 group-focus-visible/rack:opacity-100" />
        {soldOut && <span className="absolute bottom-3 left-3 rounded-sm bg-gray-900 px-2 py-1 text-xs font-bold text-white">Sin stock</span>}
      </div>
      <p className="mt-3 text-[10px] uppercase tracking-widest text-gray-400">Soportes de madera natural</p>
      <h3 className="mt-1 text-sm font-semibold group-hover/rack:text-brand-500">{product.name}</h3>
      <p className="mt-1 text-sm font-bold">{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price)}</p>
    </Link>
  )
}
