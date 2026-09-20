'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { BadgeCheck, CalendarDays, MapPin, MountainSnow, X } from 'lucide-react'

export interface SalesReferenceItem {
  id: string
  title: string
  category: string
  condition: string
  location: string
  saleDate: string
  imageUrl: string | null
  listedPrice: number
  finalPrice: number
  finalPriceWasReported: boolean
  discountPercent: number
}

function formatCLP(value: number): string {
  return `$${value.toLocaleString('es-CL')}`
}

function SalePhoto({ sale, sizes }: { sale: SalesReferenceItem; sizes: string }) {
  return sale.imageUrl ? (
    <Image
      src={sale.imageUrl}
      alt={sale.title}
      fill
      sizes={sizes}
      className="object-cover"
    />
  ) : (
    <div className="flex h-full items-center justify-center bg-brand-50">
      <MountainSnow className="h-8 w-8 text-brand-300" aria-hidden="true" />
    </div>
  )
}

export default function SalesReferenceGrid({ sales }: { sales: SalesReferenceItem[] }) {
  const [selected, setSelected] = useState<SalesReferenceItem | null>(null)

  useEffect(() => {
    if (!selected) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [selected])

  if (sales.length === 0) {
    return (
      <div className="border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
        <MountainSnow className="mx-auto h-9 w-9 text-brand-300" aria-hidden="true" />
        <p className="mt-3 text-sm font-bold text-slate-700">Aún no hay ventas para mostrar.</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sales.map(sale => (
          <button
            key={sale.id}
            type="button"
            onClick={() => setSelected(sale)}
            className="group grid min-w-0 grid-cols-[104px_minmax(0,1fr)] overflow-hidden border border-slate-200 bg-white text-left shadow-sm transition hover:border-brand-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:grid-cols-[116px_minmax(0,1fr)]"
            aria-label={`Ver detalle de ${sale.title}`}
          >
            <div className="relative aspect-[4/5] w-[104px] overflow-hidden bg-slate-100 sm:w-[116px]">
              <SalePhoto sale={sale} sizes="116px" />
            </div>

            <div className="flex min-w-0 flex-col p-3">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-600">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Vendido
              </span>
              <h2 className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-900">{sale.title}</h2>
              <p className="mt-1 truncate text-[11px] text-slate-400">{sale.category}</p>

              <div className="mt-auto pt-2">
                <p className="text-[11px] font-medium text-slate-400 line-through">{formatCLP(sale.listedPrice)}</p>
                <p className="text-lg font-black leading-tight text-brand-500">{formatCLP(sale.finalPrice)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-3"
          onClick={event => {
            if (event.target === event.currentTarget) setSelected(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sale-detail-title"
            className="w-full max-w-sm bg-white p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <div className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden bg-slate-100">
                  <SalePhoto sale={selected} sizes="80px" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-600">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Vendido
                  </span>
                  <h2 id="sale-detail-title" className="mt-1 text-base font-black leading-snug text-slate-950">{selected.title}</h2>
                  <p className="mt-1 text-xs text-slate-400">{selected.category} · {selected.condition}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="-mr-1 -mt-1 p-2 text-slate-400 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                aria-label="Cerrar detalle"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-2 border-y border-slate-100 py-3 text-xs text-slate-500">
              <p className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                {selected.location}
              </p>
              <p className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                Vendido el {selected.saleDate}
              </p>
            </div>

            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Publicado</p>
                <p className="mt-1 text-sm font-semibold text-slate-400 line-through">{formatCLP(selected.listedPrice)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600">Precio final</p>
                <p className="mt-1 text-2xl font-black text-brand-500">{formatCLP(selected.finalPrice)}</p>
              </div>
            </div>

            {!selected.finalPriceWasReported && (
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                No se informó precio de cierre; mostramos el precio publicado.
              </p>
            )}
            {selected.discountPercent > 0 && (
              <p className="mt-3 text-xs font-bold text-brand-600">{selected.discountPercent}% bajo el precio publicado</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
