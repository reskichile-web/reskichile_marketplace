import type { Metadata } from 'next'
import { CONDITIONS, PRODUCT_TYPES } from '@/lib/constants'
import {
  isRecordedSaleFromYear,
  recordedFinalPrice,
  recordedSaleDate,
  type RecordedSale,
} from '@/lib/sales-reference'
import { createServiceRoleClient } from '@/lib/supabase/server'
import SalesReferenceGrid, {
  type SalesReferenceItem,
} from '@/components/SalesReferenceGrid'

// Runtime-only: CI deliberately uses an unreachable Supabase URL, while this
// public page reads the current sales directly from the production database.
export const dynamic = 'force-dynamic'

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
  product_images: Array<{ url: string; order: number }> | null
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
    .select('id, product_type, brand, model, condition, region, comuna, price, sale_price, sold_at, updated_at, product_images(url, "order")')
    .eq('status', 'sold')
    .limit(1000)

  if (error) throw new Error('No pudimos cargar la referencia de ventas')

  return ((data || []) as unknown as SaleRow[])
    .filter(sale => isRecordedSaleFromYear(sale))
    .sort((a, b) => {
      const imageOrder = Number(Boolean(saleImage(b))) - Number(Boolean(saleImage(a)))
      return imageOrder || recordedSaleDate(b).getTime() - recordedSaleDate(a).getTime()
    })
}

export default async function SalesReferencePage() {
  const sales = await getRecordedSales()
  const items: SalesReferenceItem[] = sales.map(sale => {
    const finalPrice = recordedFinalPrice(sale)
    return {
      id: sale.id,
      title: [sale.brand, sale.model].filter(Boolean).join(' '),
      category: PRODUCT_TYPES[sale.product_type] || sale.product_type,
      condition: CONDITIONS[sale.condition] || sale.condition,
      location: `${sale.comuna}, ${sale.region}`,
      saleDate: formatSaleDate(sale),
      imageUrl: saleImage(sale),
      listedPrice: sale.price,
      finalPrice,
      finalPriceWasReported: sale.sale_price != null,
      discountPercent: sale.price > finalPrice
        ? Math.round(((sale.price - finalPrice) / sale.price) * 100)
        : 0,
    }
  })

  return (
    <div className="bg-slate-50">
      <section className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
        <h1 className="mb-7 font-body text-3xl font-black italic tracking-tight text-brand-500 md:mb-9 md:text-5xl">
          Productos vendidos 2026
        </h1>

        <SalesReferenceGrid sales={items} />

        <p className="mt-8 text-xs leading-relaxed text-slate-400">
          Información anonimizada. Si no se informó un precio final, usamos el precio publicado como referencia.
        </p>
      </section>
    </div>
  )
}
