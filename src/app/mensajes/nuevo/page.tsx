import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import ChatRoom from '@/components/chat/ChatRoom'
import { PRODUCT_TYPES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: { product?: string }
}

export default async function NuevoChatPage({ searchParams }: Props) {
  const productId = searchParams.product
  if (!productId) redirect('/catalogo')

  const supabase = createServerSupabaseClient()

  // Parallelize: auth + product fetch don't depend on each other
  const [authRes, productRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('products')
      .select('id, brand, model, slug, product_type, price, seller_id, product_images(url, order)')
      .eq('id', productId)
      .single(),
  ])
  const user = authRes.data.user
  const product = productRes.data
  if (!user) redirect(`/auth/login?redirect=/mensajes/nuevo?product=${productId}`)
  if (!product) notFound()
  if (!product.seller_id) redirect(`/producto/${product.slug || product.id}`)
  if (product.seller_id === user.id) redirect(`/producto/${product.slug || product.id}`)

  // Parallelize: existing-conversation check + seller profile
  const [existingRes, sellerRes] = await Promise.all([
    supabase
      .from('conversations')
      .select('id')
      .eq('product_id', productId)
      .eq('buyer_id', user.id)
      .eq('seller_id', product.seller_id)
      .maybeSingle(),
    supabase.from('users').select('id, name, avatar_url').eq('id', product.seller_id).single(),
  ])
  if (existingRes.data) redirect(`/mensajes/${existingRes.data.id}`)
  const seller = sellerRes.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productImage = (product as any).product_images?.sort(
    (a: { order: number }, b: { order: number }) => a.order - b.order
  )[0]?.url

  return (
    <div className="flex flex-col h-[100dvh] md:h-[calc(100vh-130px)] max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white">
        <Link
          href="/mensajes"
          aria-label="Volver"
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-body font-semibold text-sm truncate">{seller?.name || 'Usuario'}</p>
          <Link
            href={`/producto/${product.slug || product.id}`}
            className="text-xs text-gray-500 hover:text-gray-800 truncate block"
          >
            {PRODUCT_TYPES[product.product_type]}: {[product.brand, product.model].filter(Boolean).join(' ')} · ${product.price?.toLocaleString('es-CL')}
          </Link>
        </div>
        {productImage && (
          <Link href={`/producto/${product.slug || product.id}`} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={productImage} alt="" className="w-10 h-10 rounded-md object-cover bg-gray-100" />
          </Link>
        )}
      </div>

      <ChatRoom
        conversationId={undefined}
        draftProductId={product.id}
        myId={user.id}
        initialMessages={[]}
      />
    </div>
  )
}
