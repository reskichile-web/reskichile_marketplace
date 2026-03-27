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

  const categoryOrder = ['esquis', 'botas_esqui', 'pantalones', 'snowboards', 'cascos', 'parkas']
  const topCategories = categoryOrder
    .filter(type => categoryCounts[type])
    .map(type => [type, categoryCounts[type]] as [string, number])


  const categoryImages: Record<string, string> = {
    esquis: '/images/3.png',
    snowboards: '/images/snowboard.jpg',
    botas_esqui: '/images/ski-boots.jpeg',
    botas_snowboard: 'https://images.unsplash.com/photo-1522056615691-da7b8106c665?w=600&q=80&fit=crop',
    cascos: '/images/1.png',
    antiparras: 'https://images.unsplash.com/photo-1515876305430-f06edab8282a?w=600&q=80&fit=crop',
    parkas: '/images/2.png',
    pantalones: '/images/pants-category.jpg',
    fijaciones: 'https://images.unsplash.com/photo-1486495939893-f3b5e43adf29?w=600&q=80&fit=crop',
    guantes: 'https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=600&q=80&fit=crop',
    mochilas: 'https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=600&q=80&fit=crop',
    bolsos: 'https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=600&q=80&fit=crop',
    otros: 'https://images.unsplash.com/photo-1551524559-8af4e6624178?w=600&q=80&fit=crop',
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden -mt-[96px] md:-mt-[131px]">
        <img src="/images/hero-mobile.jpeg" alt="" className="absolute -top-[5%] left-0 right-0 h-[160%] w-full object-cover object-top md:hidden" />
        <img src="https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=3840&q=90&fit=crop" alt="" className="absolute inset-0 w-full h-full object-cover object-top hidden md:block" />
        <div className="absolute inset-0 bg-white/65 md:bg-white/80" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 md:px-6 pt-[140px] md:pt-[220px] pb-16 md:pb-32">
        <h1 className="font-body text-3xl md:text-5xl lg:text-6xl font-black leading-[1.1] max-w-4xl">
          Encuentra lo mejor en <RotatingWord />
        </h1>
        <p className="text-gray-500 text-xl md:text-2xl mt-6 leading-relaxed">
          Mismo equipo, mejor precio. <span className="whitespace-nowrap">El <span className="underline decoration-brand-500 decoration-2 underline-offset-4">snowmarket</span> de Chile.</span>
        </p>
        <div className="flex flex-row justify-center md:justify-start gap-3 sm:gap-4 mt-8 md:mt-10">
          <Link
            href="/catalogo"
            className="inline-flex items-center justify-center gap-1.5 md:gap-2.5 bg-brand-500 text-white px-4 md:px-8 py-2.5 md:py-3.5 rounded-full font-medium shadow-sm hover:bg-brand-600 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-xs md:text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            Explorar ofertas
          </Link>
          <Link
            href="/vender"
            className="inline-flex items-center justify-center gap-1.5 md:gap-2.5 border border-gray-300 bg-white px-4 md:px-8 py-2.5 md:py-3.5 rounded-full font-medium shadow-sm hover:border-gray-400 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-xs md:text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Publicar equipo
          </Link>
        </div>
        </div>
      </section>

      {/* Categories — Bauhaus grid */}
      {topCategories.length > 0 && (
        <section className="max-w-[1000px] mx-auto px-4 md:px-6 pt-6 md:pt-10 pb-12 md:pb-20">
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
                imagePosition={type === 'pantalones' ? 'object-[center_70%]' : undefined}
                darkOverlay={type === 'pantalones'}
              />
            ))}
          </div>
        </section>
      )}

      {/* CTA — simple card */}
      <section className="max-w-[1000px] mx-auto md:px-6">
        <div className="relative md:rounded-2xl overflow-hidden p-10 md:p-16 text-center">
          <img src="/images/pantalones.svg" alt="" className="absolute inset-0 w-full h-full object-cover scale-110" />
          <div className="absolute inset-0 bg-white/80" />
          <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white/90 to-transparent md:hidden" />
          <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white/90 to-transparent md:hidden" />
          <div className="relative">
            <h2 className="font-body text-2xl md:text-4xl font-black text-gray-900">
              ¿Tienes equipo que ya no usas?
            </h2>
            <p className="text-gray-500 mt-4 text-lg hidden md:block">
              Publícalo gratis y encuentra un nuevo dueño.
            </p>
            <Link
              href="/vender"
              className="inline-block mt-8 bg-brand-500 text-white px-10 py-4 rounded-lg font-medium hover:bg-brand-600 transition-colors"
            >
              Publicar producto
            </Link>
          </div>
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
