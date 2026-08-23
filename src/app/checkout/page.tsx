import { notFound, redirect } from 'next/navigation'
import { createPublicServerClient } from '@/lib/supabase/server'
import { getAddressConfig, getPaymentConfig } from '@/lib/env/server'
import CheckoutForm from '@/components/checkout/CheckoutForm'
import SkiRackCheckout from '@/components/checkout/SkiRackCheckout'
import { getSkiRackProduct } from '@/lib/ski-rack-products'
import { isSkiRackStorefrontEnabled } from '@/lib/ski-rack-visibility'

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
  const showSkiRacks = isSkiRackStorefrontEnabled()

  if (rackProduct) {
    if (!showSkiRacks) notFound()
    redirect(`/ski-rack/${rackProduct.slug}`)
  }

  if (query.racks === '1') {
    if (!showSkiRacks) notFound()
    let enabled = false
    let sandbox = true
    let addressValidationEnabled = false
    try {
      const config = getPaymentConfig()
      enabled = config.enabled
      sandbox = config.environment === 'integration'
      addressValidationEnabled = getAddressConfig().enabled
    } catch {
      enabled = false
    }
    return <SkiRackCheckout enabled={enabled} sandbox={sandbox} addressValidationEnabled={addressValidationEnabled} />
  }

  if (!UUID_RE.test(productId)) notFound()

  const supabase = createPublicServerClient()
  const { data: product } = await supabase
    .from('products')
    .select('id, brand, model, price, commerce_owned, product_images(url, order)')
    .eq('id', productId)
    .eq('status', 'approved')
    .eq('commerce_owned', true)
    .maybeSingle()

  if (!product) notFound()

  let enabled = false
  let sandbox = true
  let addressValidationEnabled = false
  try {
    const config = getPaymentConfig()
    enabled = config.enabled
    sandbox = config.environment === 'integration'
    addressValidationEnabled = getAddressConfig().enabled
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
        imageUrl: ((product.product_images as { url: string; order: number }[] | null) || [])
          .slice()
          .sort((a, b) => a.order - b.order)[0]?.url,
      }]}
      kind="products"
      enabled={enabled}
      sandbox={sandbox}
      addressValidationEnabled={addressValidationEnabled}
    />
  )
}
