import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PRODUCT_TYPES, CONDITIONS } from '@/lib/constants'

export default async function HomePage() {
  const supabase = createServerSupabaseClient()

  const { data: products } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(8)

  return (
    <div>
      <section className="bg-blue-600 text-white py-10 md:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4">
            Compra y vende equipamiento de montaña usado
          </h1>
          <p className="text-sm md:text-lg text-blue-100 mb-6 md:mb-8">
            Ski, snowboard y más. El marketplace especializado de Chile.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link href="/catalogo" className="bg-white text-blue-600 px-6 py-3 rounded font-medium hover:bg-blue-50">
              Ver catálogo
            </Link>
            <Link href="/vender" className="border border-white px-6 py-3 rounded font-medium hover:bg-blue-700">
              Publicar producto
            </Link>
          </div>
        </div>
      </section>

      {products && products.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold mb-6">Publicaciones recientes</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products.map((product) => {
              const mainImage = product.product_images?.sort(
                (a: { order: number }, b: { order: number }) => a.order - b.order
              )[0]
              const title = [product.brand, product.model].filter(Boolean).join(' ')

              return (
                <Link key={product.id} href={`/producto/${product.id}`} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-square bg-gray-100">
                    {mainImage ? (
                      <img src={mainImage.url} alt={title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Sin foto</div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-blue-600 font-medium">{PRODUCT_TYPES[product.product_type]}</p>
                    <h3 className="font-medium text-sm truncate">{title}</h3>
                    <p className="text-lg font-bold text-blue-600">${product.price.toLocaleString('es-CL')}</p>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                      {CONDITIONS[product.condition] || product.condition}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
          <div className="text-center mt-8">
            <Link href="/catalogo" className="text-blue-600 hover:underline font-medium">Ver todo el catálogo</Link>
          </div>
        </section>
      )}
    </div>
  )
}
