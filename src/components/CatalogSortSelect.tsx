'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpDown } from 'lucide-react'

export default function CatalogSortSelect({ value }: { value: string }) {
  const router = useRouter()
  const sp = useSearchParams()

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(sp.toString())
    if (e.target.value === 'recent') params.delete('sort')
    else params.set('sort', e.target.value)
    router.push(`/catalogo${params.toString() ? '?' + params.toString() : ''}`)
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-600">
      <ArrowUpDown className="w-4 h-4 text-gray-400" />
      <select
        value={value}
        onChange={onChange}
        className="bg-transparent border-0 font-body font-medium text-gray-700 focus:outline-none cursor-pointer"
      >
        <option value="recent">Más recientes</option>
        <option value="price_asc">Precio: menor a mayor</option>
        <option value="price_desc">Precio: mayor a menor</option>
      </select>
    </label>
  )
}
