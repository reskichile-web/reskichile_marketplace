import { notFound, redirect } from 'next/navigation'
import { createPublicServerClient } from '@/lib/supabase/server'
import { getPaymentConfig } from '@/lib/env/server'
import CheckoutForm from '@/components/checkout/CheckoutForm'
import SkiRackCheckout from '@/components/checkout/SkiRackCheckout'
import { getSkiRackProduct } from '@/lib/ski-rack-products'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface Props {
  searchParams: Promise<{ producto?: string; racks?: string }>
}

export default async function CheckoutPage({ searchParams }: Props) {
  const query = await searchParams
  const productId = query.producto || ''
  const rackProduct = getSkiRackProduct(productId)

  if (rackProduct) redirect(`/ski-rack/${rackProduct.slug}`)

  if (query.racks === '1') {
    let enabled = false
    let sandbox = true
    try {
      const config = getPaymentConfig()
      enabled = config.enabled
      sandbox = config.environment === 'integration'
    } catch {
      enabled = false
    }
    return <SkiRackCheckout enabled={enabled} sandbox={sandbox} />
  }

  if (!UUID_RE.test(productId)) notFound()

  const supabase = createPublicServerClient()
  const { data: product } = await supabase
    .from('products')
    .select('id, brand, model, price, commerce_owned')
    .eq('id', productId)
    .eq('status', 'approved')
    .eq('commerce_owned', true)
    .maybeSingle()

  if (!product) notFound()

  let enabled = false
  let sandbox = true
  try {
    const config = getPaymentConfig()
    enabled = config.enabled
    sandbox = config.environment === 'integration'
  } catch {
    enabled = false
  }

  return (
    <CheckoutForm
      items={[{
        id: String(product.id),
        name: [product.brand, product.model].filter(Boolean).join(' '),
        priceClp: Number(product.price),
        quantity: 1,
        backHref: '/producto/' + product.id,
      }]}
      kind="products"
      enabled={enabled}
      sandbox={sandbox}
    />
  )
}
