'use client'

import Image from 'next/image'
import Link from 'next/link'
import { getSkiRackProduct } from '@/lib/ski-rack-products'
import { useRackInventory } from '@/lib/use-rack-inventory'
import { totalRackAvailability } from '@/lib/rack-inventory'

export default function PinnedSkiRack() {
  const product = getSkiRackProduct('madera')!
  const { inventory, loading, error } = useRackInventory()
  const stock = inventory.madera
  const soldOut = !loading && !error && totalRackAvailability(stock) === 0
  const price = stock?.priceClp ?? product.priceClp
  return (
    <Link href="/ski-rack/madera" className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-gray-50">
        <Image src={product.image} alt={product.imageAlt} fill sizes="(max-width: 640px) 45vw, 25vw" className="object-cover" />
        <span className="absolute left-3 top-3 rounded-sm bg-brand-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Destacado</span>
        {soldOut && <span className="absolute bottom-3 left-3 rounded-sm bg-gray-900 px-2 py-1 text-xs font-bold text-white">Sin stock</span>}
      </div>
      <p className="mt-3 text-[10px] uppercase tracking-widest text-gray-400">Soportes de madera natural</p>
      <h3 className="mt-1 text-sm font-semibold group-hover:text-brand-500">{product.name}</h3>
      <p className="mt-1 text-sm font-bold">{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price)}</p>
    </Link>
  )
}
