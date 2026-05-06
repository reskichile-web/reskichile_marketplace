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

            const status = product.status
            const isSold = status === 'sold'
            const isRejected = status === 'rejected'
            const isArchived = status === 'archived'
            const isPending = status === 'pending'
            // Locked = no editing allowed
            const showEdit = !isSold && !isRejected && !isArchived && !isPending

            // Card-level styling
            const cardCls = isSold
              ? 'bg-brand-500 border-brand-500 text-white'
              : isRejected
                ? 'bg-red-500 border-red-500 text-white'
                : isArchived
                  ? 'bg-gray-200 border-gray-300'
                  : 'bg-white border-gray-200'

            const titleCls = (isSold || isRejected) ? 'text-white' : (isArchived ? 'text-gray-500' : 'text-gray-900')
            const typeCls = (isSold || isRejected) ? 'text-white/85' : (isArchived ? 'text-gray-400' : 'text-brand-500')
            const priceCls = (isSold || isRejected) ? 'text-white' : (isArchived ? 'text-gray-500' : 'text-brand-500')
            const subCls = (isSold || isRejected) ? 'text-white/85' : (isArchived ? 'text-gray-400' : 'text-gray-500')
            const placeholderBg = (isSold || isRejected) ? 'bg-white/15' : (isArchived ? 'bg-gray-300' : 'bg-gray-100')
            const placeholderIcon = (isSold || isRejected) ? 'text-white/50' : 'text-gray-300'
            const showCornerVignette = !isSold && !isRejected && !isArchived
            const showBigRightIcon = isSold || isRejected
            const labelCls = (isSold || isRejected)
              ? 'text-xs font-medium text-white/90'
              : (isArchived ? 'text-xs font-medium text-gray-500' : 'text-xs font-light text-gray-400')

            return (
              <div key={product.id} className={`relative border rounded-lg p-4 overflow-hidden ${cardCls}`}>
                <div className={`flex gap-3 ${showBigRightIcon ? 'pr-24 sm:pr-28' : ''}`}>
                  {mainImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mainImage.url}
                      alt={title}
                      className={`w-16 h-16 sm:w-24 sm:h-24 object-cover rounded shrink-0 ${isArchived ? 'grayscale opacity-80' : ''}`}
                    />
                  ) : (
                    <div className={`w-16 h-16 sm:w-24 sm:h-24 rounded shrink-0 flex items-center justify-center ${placeholderBg}`}>
                      <svg className={`w-8 h-8 ${placeholderIcon}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${typeCls}`}>{PRODUCT_TYPES[product.product_type]}</p>
                    <h2 className={`font-body font-medium truncate pr-8 ${titleCls}`}>{title}</h2>
                    <p className={`font-body text-lg font-semibold mt-1 ${priceCls}`}>${product.price.toLocaleString('es-CL')}</p>
                    <p className={`text-xs truncate ${subCls}`}>{CONDITIONS[product.condition]} · {product.region}</p>
                  </div>
                </div>

                {/* Big right-edge icon for sold/rejected — full card height */}
                {showBigRightIcon && (
                  <div className="absolute top-0 right-0 bottom-0 w-20 sm:w-24 flex items-center justify-center text-white pointer-events-none">
                    {isSold ? (
                      <svg className="w-16 h-16 sm:w-20 sm:h-20 opacity-90" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-14 h-14 sm:w-16 sm:h-16 opacity-90" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 mt-3">
                  <div className="flex gap-2">
                    <Link
                      href={`/producto/${product.id}`}
                      className={`w-20 text-center text-xs py-1.5 rounded font-medium ${
                        (isSold || isRejected)
                          ? 'bg-white/15 text-white hover:bg-white/25'
                          : isArchived
                            ? 'bg-gray-100 text-gray-500 hover:bg-gray-300'
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                    >
                      Ver
                    </Link>
                    {showEdit && (
                      <Link href={`/producto/${product.id}/editar`} className="w-20 text-center text-xs bg-brand-500 text-white py-1.5 rounded font-medium hover:bg-brand-600">
                        Editar
                      </Link>
                    )}
                  </div>
                  <ProductStatusBlock
                    status={status}
                    rejectionReason={product.rejection_reason}
                    cornerVignette={showCornerVignette}
                    labelClassName={labelCls}
                  />
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
