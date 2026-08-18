import type { Metadata } from 'next'
import SkiRackCartPage from '@/components/SkiRackCartPage'

export const metadata: Metadata = {
  title: 'Carrito · ReskiChile',
  description: 'Carrito de compra Ski Rack en ReskiChile.',
}

export default function CartPage() {
  return <SkiRackCartPage />
}
