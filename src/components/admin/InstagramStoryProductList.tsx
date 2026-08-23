'use client'

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from 'react'
import { ChevronRight, ImagePlus, Search } from 'lucide-react'
import type { InstagramAdminProduct } from '@/lib/instagram/admin-contracts'
import { displayLocalDate, formatClp, storyStatus } from '@/lib/instagram/admin-ui'

interface Props {
  products: InstagramAdminProduct[]
  onOpen: (productId: string) => void
}

export default function InstagramStoryProductList({ products, onOpen }: Props) {
  const [search, setSearch] = useState('')
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    return term
      ? products.filter((product) => product.title.toLocaleLowerCase('es').includes(term))
      : products
  }, [products, search])

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="border-b border-gray-200 bg-white px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
              <ImagePlus className="h-4 w-4" /> Preparador
            </div>
            <h2 className="mt-1 text-base font-semibold text-gray-800">Generar historias</h2>
          </div>
          <label className="relative block w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar producto…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-gray-400 focus:bg-white"
            />
          </label>
        </div>
      </header>

      <div className="max-h-[620px] overflow-auto">
        {visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">No encontramos productos.</div>
        ) : (
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="border-b border-gray-200 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">
                <th className="px-5 py-2.5">Producto</th>
                <th className="w-36 px-4 py-2.5">Precio</th>
                <th className="w-40 px-4 py-2.5">Estado</th>
                <th className="w-52 px-4 py-2.5">Programación</th>
                <th className="w-32 px-5 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => {
                const status = storyStatus(product)
                return (
                  <tr
                    key={product.id}
                    onClick={() => onOpen(product.id)}
                    className="cursor-pointer border-b border-gray-100 transition hover:bg-gray-50"
                  >
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-gray-100 bg-gray-50">
                          {product.imageUrl && <img src={product.imageUrl} alt="" className="h-full w-full object-contain" />}
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-md truncate font-medium text-gray-900">{product.title}</p>
                          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-400">{product.productType}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-brand-600">{formatClp(product.price)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${status.className}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {product.capture?.scheduledLocalDate
                        ? displayLocalDate(product.capture.scheduledLocalDate)
                        : <span className="text-gray-300">Sin agendar</span>}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpen(product.id)
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600"
                      >
                        Gestionar <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
