import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PRODUCT_TYPES, CONDITIONS, PRODUCT_STATUSES } from '@/lib/constants'

export default async function MyProductsPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div className="max-w-4xl mx-auto mt-16 px-4">No autorizado</div>
  }

  const { data: products } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mis productos</h1>
        <Link href="/vender" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">
          + Publicar nuevo
        </Link>
      </div>

      {!products || products.length === 0 ? (
        <p className="text-gray-500">No tienes productos publicados aún.</p>
      ) : (
        <div className="space-y-4">
          {products.map((product) => {
            const mainImage = product.product_images?.sort(
              (a: { order: number }, b: { order: number }) => a.order - b.order
            )[0]
            const title = [product.brand, product.model].filter(Boolean).join(' ')

            const statusColor: Record<string, string> = {
              draft: 'bg-gray-100 text-gray-700',
              pending: 'bg-yellow-100 text-yellow-700',
              approved: 'bg-green-100 text-green-700',
              rejected: 'bg-red-100 text-red-700',
              sold: 'bg-blue-100 text-blue-700',
              archived: 'bg-gray-100 text-gray-500',
            }

            return (
              <div key={product.id} className="border rounded-lg p-4">
                <div className="flex gap-3">
                  {mainImage && (
                    <img src={mainImage.url} alt={title} className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-blue-600 font-medium">{PRODUCT_TYPES[product.product_type]}</p>
                        <h2 className="font-medium truncate">{title}</h2>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded whitespace-nowrap shrink-0 ${statusColor[product.status] || ''}`}>
                        {PRODUCT_STATUSES[product.status] || product.status}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-blue-600 mt-1">${product.price.toLocaleString('es-CL')}</p>
                    <p className="text-xs text-gray-500">{CONDITIONS[product.condition]} · {product.region}</p>
                  </div>
                </div>
                {product.rejection_reason && (
                  <p className="text-sm text-red-600 mt-2">Motivo de rechazo: {product.rejection_reason}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
