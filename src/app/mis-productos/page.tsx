import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import Link from 'next/link'
import { PRODUCT_TYPES, CONDITIONS } from '@/lib/constants'
import EmptyState from '@/components/illustrations/EmptyState'
import ProductStatusBlock from '@/components/ProductStatusBlock'
import DeleteProductButton from '@/components/DeleteProductButton'

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

            // Card-level styling — sold/rejected are muted but still clearly colored.
            const cardCls = isSold
              ? 'bg-brand-50 border-brand-200'
              : isRejected
                ? 'bg-red-50 border-red-200'
                : isArchived
                  ? 'bg-gray-100 border-gray-200'
                  : 'bg-white border-gray-200'

            const titleCls = isSold
              ? 'text-brand-700'
              : isRejected
                ? 'text-red-700'
                : isArchived
                  ? 'text-gray-500'
                  : 'text-gray-900'
            const typeCls = isSold
              ? 'text-brand-500/80'
              : isRejected
                ? 'text-red-500/80'
                : isArchived
                  ? 'text-gray-400'
                  : 'text-brand-500'
            const priceCls = isSold
              ? 'text-brand-500'
              : isRejected
                ? 'text-red-500'
                : isArchived
                  ? 'text-gray-500'
                  : 'text-brand-500'
            const subCls = isSold
              ? 'text-brand-500/70'
              : isRejected
                ? 'text-red-500/70'
                : isArchived
                  ? 'text-gray-400'
                  : 'text-gray-500'
            const placeholderBg = isSold
              ? 'bg-brand-100'
              : isRejected
                ? 'bg-red-100'
                : isArchived
                  ? 'bg-gray-200'
                  : 'bg-gray-100'
            const placeholderIcon = isSold
              ? 'text-brand-300'
              : isRejected
                ? 'text-red-300'
                : 'text-gray-300'
            const imageDimCls = (isSold || isRejected || isArchived) ? 'grayscale opacity-70' : ''
            const showCornerVignette = !isSold && !isRejected && !isArchived
            const showBigRightIcon = isSold || isRejected
            const labelCls = isArchived
              ? 'text-xs font-medium text-gray-500'
              : 'text-xs font-light text-gray-400'

            const trashIconCls = isSold
              ? 'text-brand-400/60 hover:text-red-500 transition-colors'
              : isRejected
                ? 'text-red-400/60 hover:text-red-700 transition-colors'
                : isArchived
                  ? 'text-gray-400 hover:text-red-500 transition-colors'
                  : 'text-gray-300 hover:text-red-500 transition-colors'

            const verBtnCls = isSold
              ? 'bg-white text-brand-600 border border-brand-200 hover:bg-brand-50'
              : isRejected
                ? 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
                : isArchived
                  ? 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  : 'bg-gray-900 text-white hover:bg-gray-800'

            return (
              <div key={product.id} className={`relative border rounded-lg p-4 overflow-hidden ${cardCls}`}>
                {/* Trash icon — top-right of every card */}
                <div className="absolute top-2 right-2 z-10">
                  <DeleteProductButton
                    productId={product.id}
                    productTitle={title || 'esta publicación'}
                    iconClassName={trashIconCls}
                  />
                </div>

                <div className={`flex gap-3 ${showBigRightIcon ? 'pr-24 sm:pr-28' : 'pr-8'}`}>
                  {mainImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mainImage.url}
                      alt={title}
                      className={`w-16 h-16 sm:w-24 sm:h-24 object-cover rounded shrink-0 ${imageDimCls}`}
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

                {/* Big right-edge icon + label for sold/rejected — spans full card height */}
                {showBigRightIcon && (
                  <div className={`absolute top-0 right-0 bottom-0 w-24 sm:w-28 flex flex-col items-center justify-center pointer-events-none ${isSold ? 'text-brand-500' : 'text-red-500'}`}>
                    {isSold ? (
                      <svg className="w-14 h-14 sm:w-16 sm:h-16" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-12 h-12 sm:w-14 sm:h-14" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className="mt-1 text-xs font-bold uppercase tracking-wider">
                      {isSold ? 'Vendido' : 'Rechazado'}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 mt-3">
                  <div className="flex gap-2">
                    <Link
                      href={`/producto/${product.id}`}
                      className={`w-20 text-center text-xs py-1.5 rounded font-medium ${verBtnCls}`}
                    >
                      Ver
                    </Link>
                    {showEdit && (
                      <Link href={`/producto/${product.id}/editar`} className="w-20 text-center text-xs bg-brand-500 text-white py-1.5 rounded font-medium hover:bg-brand-600">
                        Editar
                      </Link>
                    )}
                  </div>
                  {/* Status label hidden for sold/rejected (shown as the centered right-side label).
                      For rejected, ProductStatusBlock still surfaces the rejection-motivo button. */}
                  {!isSold && (
                    <ProductStatusBlock
                      status={status}
                      rejectionReason={product.rejection_reason}
                      cornerVignette={showCornerVignette}
                      labelClassName={isRejected ? 'sr-only' : labelCls}
                    />
                  )}
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
