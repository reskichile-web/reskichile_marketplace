import type { Metadata } from 'next'
import SkiRackStory from '@/components/SkiRackStory'

export const metadata: Metadata = {
  title: 'Ski Rack · ReskiChile',
  description: 'Ski racks de madera, hechos a mano en Chile. Para tu casa, parcela o refugio.',
}

export default function SkiRackPage() {
  return <SkiRackStory />
}
