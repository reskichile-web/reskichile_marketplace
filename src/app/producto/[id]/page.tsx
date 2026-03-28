import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { PRODUCT_TYPES } from '@/lib/constants'
import type { ProductWithImages } from '@/lib/types'
import ProductDetailClient from '@/components/ProductDetailClient'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createServerSupabaseClient()
  const { data: product } = await supabase
    .from('products')
    .select('brand, model, price, product_type, product_images(url, order)')
    .eq('id', params.id)
    .single()

  if (!product) return { title: 'Producto no encontrado - ReskiChile' }

  const title = [product.brand, product.model].filter(Boolean).join(' ')
  const mainImage = (product.product_images as { url: string; order: number }[])
    ?.sort((a, b) => a.order - b.order)[0]

  return {
    title: `${title} - ReskiChile`,
    description: `${PRODUCT_TYPES[product.product_type] || product.product_type} - $${product.price.toLocaleString('es-CL')} en ReskiChile`,
    openGraph: {
      title: `${title} - ReskiChile`,
      description: `${PRODUCT_TYPES[product.product_type] || product.product_type} por $${product.price.toLocaleString('es-CL')}`,
      images: mainImage ? [{ url: mainImage.url }] : [],
    },
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { user, isAdmin } = await getAuthUser()
  const supabase = createServerSupabaseClient()

  const { data } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('id', params.id)
    .single()

  if (!data) notFound()

  const product = data as unknown as ProductWithImages

  return (
    <ProductDetailClient
      product={product}
      userId={user?.id ?? null}
      isAdmin={isAdmin}
    />
  )
}
