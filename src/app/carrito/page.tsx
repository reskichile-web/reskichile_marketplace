import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SkiRackCartPage from '@/components/SkiRackCartPage'
import { isSkiRackStorefrontEnabled } from '@/lib/ski-rack-visibility'

export const metadata: Metadata = {
  title: 'Carrito · ReskiChile',
  description: 'Carrito de compra Ski Rack en ReskiChile.',
}

export const dynamic = 'force-dynamic'

export default function CartPage() {
  if (!isSkiRackStorefrontEnabled()) notFound()
  return <SkiRackCartPage />
}
