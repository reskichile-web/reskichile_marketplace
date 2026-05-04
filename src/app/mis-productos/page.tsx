import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import Link from 'next/link'
import { PRODUCT_TYPES, CONDITIONS } from '@/lib/constants'
import EmptyState from '@/components/illustrations/EmptyState'
import ProductStatusBlock from '@/components/ProductStatusBlock'

export default async function MyProductsPage() {
  const { user } = await getAuthUser()

  if (!user) {
    return <div className="max-w-4xl mx-auto mt-16 px-4">No autorizado</div>
  }

  const supabase = createServerSupabaseClient()

  const { data: products } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto px-4 min-h-screen pt-10 md:pt-14 pb-20">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="font-body text-3xl font-black">Mis productos</h1>
          <Link href="/vender" className="bg-brand-500 text-white px-5 py-2.5 rounded-lg hover:bg-brand-600 text-sm font-medium">
            + Publicar nuevo
          </Link>
        </div>

      {!products || products.length === 0 ? (
        <EmptyState
          title="Aun no tienes productos"
          description="Publica tu primer equipo y encuentra un nuevo dueno."
          actionLabel="Publicar producto"
          actionHref="/vender"
        />
      ) : (
        <div className="space-y-4">
          {products.map((product) => {
            const mainImage = product.product_images?.sort(
              (a: { order: number }, b: { order: number }) => a.order - b.order
            )[0]
            const title = [product.brand, product.model].filter(Boolean).join(' ')

            return (
              <div key={product.id} className="relative border rounded-lg p-4">
                <div className="flex gap-3">
                  {mainImage ? (
                    <img src={mainImage.url} alt={title} className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded shrink-0" />
                  ) : (
                    <div className="w-16 h-16 sm:w-24 sm:h-24 rounded shrink-0 bg-gray-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-brand-500 font-medium">{PRODUCT_TYPES[product.product_type]}</p>
                    <h2 className="font-body font-medium truncate pr-8">{title}</h2>
                    <p className="font-body text-lg font-semibold text-brand-500 mt-1">${product.price.toLocaleString('es-CL')}</p>
                    <p className="text-xs text-gray-500 truncate">{CONDITIONS[product.condition]} · {product.region}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-3">
                  <div className="flex gap-2">
                    <Link href={`/producto/${product.id}`} className="w-20 text-center text-xs bg-gray-900 text-white py-1.5 rounded font-medium hover:bg-gray-800">
                      Ver
                    </Link>
                    <Link href={`/producto/${product.id}/editar`} className="w-20 text-center text-xs bg-brand-500 text-white py-1.5 rounded font-medium hover:bg-brand-600">
                      Editar
                    </Link>
                  </div>
                  <ProductStatusBlock status={product.status} rejectionReason={product.rejection_reason} />
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}
