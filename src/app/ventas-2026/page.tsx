import type { Metadata } from 'next'
import Image from 'next/image'
import {
  BadgeCheck,
  CalendarDays,
  MapPin,
  MountainSnow,
  Snowflake,
  TrendingDown,
} from 'lucide-react'
import { CONDITIONS, PRODUCT_TYPES } from '@/lib/constants'
import {
  isRecordedSaleFromYear,
  recordedFinalPrice,
  recordedSaleDate,
  recordedSalesSummary,
  type RecordedSale,
} from '@/lib/sales-reference'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const revalidate = 900

export const metadata: Metadata = {
  title: 'Ventas 2026 · Precios reales de equipamiento usado',
  description: 'Referencia de precios de ventas de equipamiento de montaña usado registradas durante 2026 en ReSkiChile.',
}

interface SaleRow extends RecordedSale {
  id: string
  product_type: string
  brand: string
  model: string | null
  condition: string
  region: string
  comuna: string
  days_published: number
  product_images: Array<{ url: string; order: number }> | null
}

function formatCLP(value: number): string {
  return `$${value.toLocaleString('es-CL')}`
}

function formatSaleDate(sale: RecordedSale): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Santiago',
  }).format(recordedSaleDate(sale))
}

function saleImage(sale: SaleRow): string | null {
  return sale.product_images
    ?.slice()
    .sort((a, b) => a.order - b.order)[0]?.url ?? null
}

async function getRecordedSales(): Promise<SaleRow[]> {
  const service = createServiceRoleClient()
  const { data, error } = await service
    .from('products')
    .select('id, product_type, brand, model, condition, region, comuna, price, sale_price, sold_at, updated_at, days_published, product_images(url, "order")')
    .eq('status', 'sold')
    .limit(1000)

  if (error) throw new Error('No pudimos cargar la referencia de ventas')

  return ((data || []) as unknown as SaleRow[])
    .filter(sale => isRecordedSaleFromYear(sale))
    .sort((a, b) => recordedSaleDate(b).getTime() - recordedSaleDate(a).getTime())
}

export default async function SalesReferencePage() {
  const sales = await getRecordedSales()
  const summary = recordedSalesSummary(sales)

  return (
    <div className="bg-slate-50">
      <section className="relative isolate overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(38,116,191,0.42),transparent_38%),radial-gradient(circle_at_85%_15%,rgba(126,177,225,0.22),transparent_32%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-slate-950 to-transparent" />
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-200 backdrop-blur-sm">
              <Snowflake className="h-4 w-4" aria-hidden="true" />
              Referencia de mercado 2026
            </div>
            <h1 className="font-display text-4xl leading-[0.98] tracking-wide sm:text-5xl md:text-7xl">
              Lo que realmente se vendió esta temporada
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">
              Ventas y precios informados por nuestra comunidad. Una referencia transparente para publicar, ajustar y vender mejor tu equipo usado.
            </p>
          </div>

          <div className="mt-10 grid max-w-3xl grid-cols-1 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3">
            <div className="bg-slate-950/80 p-5 backdrop-blur-sm">
              <p className="text-3xl font-black text-white">{summary.count}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">Ventas registradas</p>
            </div>
            <div className="bg-slate-950/80 p-5 backdrop-blur-sm">
              <p className="text-3xl font-black text-brand-300">{formatCLP(summary.medianSalePrice)}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">Precio final mediano</p>
            </div>
            <div className="bg-slate-950/80 p-5 backdrop-blur-sm">
              <p className="text-3xl font-black text-brand-300">{summary.medianDiscountPercent}%</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">Ajuste mediano reportado</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
        <div className="mb-10 grid gap-6 border-b border-slate-200 pb-10 md:grid-cols-[1fr_auto] md:items-end">
          <div className="max-w-3xl">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-brand-600">
              <TrendingDown className="h-4 w-4" aria-hidden="true" />
              Fin de temporada
            </p>
            <h2 className="font-body text-2xl font-black leading-tight text-slate-950 md:text-3xl">
              La demanda baja; un precio competitivo hace la diferencia.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 md:text-base">
              Compara productos similares y toma estas ventas reales como referencia. El precio publicado aparece tachado y el precio final de venta está destacado en celeste.
            </p>
          </div>
          <p className="text-xs leading-relaxed text-slate-400 md:max-w-xs md:text-right">
            Información anonimizada. Si no se informó un precio final, usamos el precio publicado como referencia.
          </p>
        </div>

        {sales.length === 0 ? (
          <div className="border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
            <MountainSnow className="mx-auto h-10 w-10 text-brand-400" aria-hidden="true" />
            <p className="mt-4 font-bold text-slate-800">Aún no hay ventas registradas para mostrar.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sales.map(sale => {
              const imageUrl = saleImage(sale)
              const title = [sale.brand, sale.model].filter(Boolean).join(' ')
              const finalPrice = recordedFinalPrice(sale)
              const discount = sale.price > finalPrice
                ? Math.round(((sale.price - finalPrice) / sale.price) * 100)
                : 0

              return (
                <article key={sale.id} className="group overflow-hidden border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-200">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover saturate-[0.82] transition duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-50 to-slate-200">
                        <MountainSnow className="h-14 w-14 text-brand-300" aria-hidden="true" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" />
                    <div className="absolute left-4 top-4 inline-flex items-center gap-2 bg-brand-500 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white shadow-lg">
                      <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                      Vendido
                    </div>
                    {discount > 0 && (
                      <div className="absolute bottom-4 right-4 bg-slate-950/85 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
                        {discount}% bajo publicación
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-600">
                      {PRODUCT_TYPES[sale.product_type] || sale.product_type}
                    </p>
                    <h3 className="mt-2 min-h-12 text-lg font-black leading-snug text-slate-950">{title}</h3>

                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                      <span>{CONDITIONS[sale.condition] || sale.condition}</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        {sale.comuna}, {sale.region}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatSaleDate(sale)}
                      </span>
                    </div>

                    <div className="mt-5 border-t border-slate-100 pt-5">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Publicado</p>
                          <p className="mt-1 text-sm font-semibold text-slate-400 line-through decoration-2">{formatCLP(sale.price)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-brand-600">Precio final de venta</p>
                          <p className="mt-1 text-2xl font-black tracking-tight text-brand-500">{formatCLP(finalPrice)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
