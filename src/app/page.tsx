export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PRODUCT_TYPES } from '@/lib/constants'
import RotatingWord from '@/components/RotatingWord'
import CategoryCard from '@/components/CategoryCard'
import ProductBrowser from '@/components/ProductBrowser'

export default async function HomePage() {
  const supabase = createServerSupabaseClient()

  const { data: products } = await supabase
    .from('products')
    .select('id, product_type, brand, model, price, condition, region, product_images(url, order)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  // Get category counts for the grid
  const { data: allProducts } = await supabase
    .from('products')
    .select('product_type')
    .eq('status', 'approved')

  const categoryCounts: Record<string, number> = {}
  allProducts?.forEach(p => {
    categoryCounts[p.product_type] = (categoryCounts[p.product_type] || 0) + 1
  })

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)


  const categoryImages: Record<string, string> = {
    esquis: '/images/3.png',
    snowboards: '/images/hamish-duncan-XO6FSH3H5CE-unsplash.jpg',
    botas_esqui: '/images/How To Choose Your Ski Boots.jpeg',
    botas_snowboard: 'https://images.unsplash.com/photo-1522056615691-da7b8106c665?w=600&q=80&fit=crop',
    cascos: '/images/1.png',
    antiparras: 'https://images.unsplash.com/photo-1515876305430-f06edab8282a?w=600&q=80&fit=crop',
    parkas: '/images/2.png',
    pantalones: '/images/pantalones.svg',
    fijaciones: 'https://images.unsplash.com/photo-1486495939893-f3b5e43adf29?w=600&q=80&fit=crop',
    guantes: 'https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=600&q=80&fit=crop',
    mochilas: 'https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=600&q=80&fit=crop',
    bolsos: 'https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=600&q=80&fit=crop',
    otros: 'https://images.unsplash.com/photo-1551524559-8af4e6624178?w=600&q=80&fit=crop',
  }

  return (
    <div>
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 pt-12 pb-10 md:pt-28 md:pb-24">
        <h1 className="font-body text-3xl md:text-7xl font-black leading-[1.1] max-w-4xl">
          Encuentra lo mejor en <RotatingWord />
        </h1>
        <p className="text-gray-500 text-lg md:text-xl mt-6 leading-relaxed">
          Mismo equipo, mejor precio. <span className="whitespace-nowrap">El <span className="underline decoration-brand-500 decoration-2 underline-offset-4">snowmarket</span> de Chile.</span>
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8 md:mt-10">
          <Link
            href="/catalogo"
            className="inline-flex items-center justify-center gap-2.5 bg-brand-500 text-white px-6 md:px-8 py-3 md:py-3.5 rounded-sm font-medium hover:bg-brand-600 transition-colors text-sm md:text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            Explorar ofertas
          </Link>
          <Link
            href="/vender"
            className="inline-flex items-center justify-center gap-2.5 border border-gray-300 px-6 md:px-8 py-3 md:py-3.5 rounded-sm font-medium hover:border-gray-400 transition-colors text-sm md:text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Publicar equipo
          </Link>
        </div>
      </section>

      {/* Categories — Bauhaus grid */}
      {topCategories.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 md:px-6 pb-12 md:pb-20">
          <h2 className="font-body text-sm font-medium tracking-widest uppercase text-gray-400 mb-8">
            Categorías
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {topCategories.map(([type, count]) => (
              <CategoryCard
                key={type}
                type={type}
                label={PRODUCT_TYPES[type] || type}
                count={count}
                image={categoryImages[type] || categoryImages.otros}
              />
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="relative overflow-hidden min-h-[350px] md:min-h-[500px] flex items-start">
        <img
          src="/images/clement-delhaye-cnluLIyhpBA-unsplash.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-[center_40%]"
        />
        <div className="absolute inset-0 bg-black/15" />
        <div className="relative max-w-5xl mx-auto px-4 md:px-6 pt-12 md:pt-20 pb-16 md:pb-32 text-center w-full">
          <h2 className="font-body text-2xl md:text-5xl font-black text-white">
            ¿Tienes equipo que ya no usas?
          </h2>
          <p className="text-white/80 mt-4 text-lg">
            Publícalo gratis y encuentra un nuevo dueño.
          </p>
          <Link
            href="/vender"
            className="inline-block mt-8 bg-brand-500 text-white px-10 py-4 rounded-sm font-medium hover:bg-brand-600 transition-colors"
          >
            Publicar producto
          </Link>
        </div>
      </section>

      {/* Spacer between CTA and products */}
      <div className="h-16 md:h-24" />

      {/* Product browser — own sticky navbar + filters */}
      {products && products.length > 0 && (
        <ProductBrowser products={products} />
      )}
    </div>
  )
}
