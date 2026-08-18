import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SkiRackProductDetail from '@/components/SkiRackProductDetail'
import {
  SKI_RACK_DESCRIPTION,
  SKI_RACK_PRODUCTS,
  getSkiRackProduct,
} from '@/lib/ski-rack-products'

interface Props {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return SKI_RACK_PRODUCTS.map((product) => ({ slug: product.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = getSkiRackProduct(slug)
  if (!product) return { title: 'Ski Rack · ReskiChile' }

  return {
    title: `${product.name} · ReskiChile`,
    description: SKI_RACK_DESCRIPTION,
    openGraph: {
      title: `${product.name} · ReskiChile`,
      description: SKI_RACK_DESCRIPTION,
      images: [{ url: product.image }],
    },
  }
}

export default async function SkiRackProductPage({ params }: Props) {
  const { slug } = await params
  const product = getSkiRackProduct(slug)
  if (!product) notFound()

  return <SkiRackProductDetail product={product} />
}
