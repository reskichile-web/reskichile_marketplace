import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SkiRackStory from '@/components/SkiRackStory'
import { isSkiRackStorefrontEnabled } from '@/lib/ski-rack-visibility'

export const metadata: Metadata = {
  title: 'Ski Rack · ReskiChile',
  description: 'Ski racks de madera, hechos a mano en Chile. Para tu casa, parcela o refugio.',
}

export const dynamic = 'force-dynamic'

export default function SkiRackPage() {
  if (!isSkiRackStorefrontEnabled()) notFound()
  return <SkiRackStory />
}
