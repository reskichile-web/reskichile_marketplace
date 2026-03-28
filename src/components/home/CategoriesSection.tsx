import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PRODUCT_TYPES } from '@/lib/constants'
import CategoryCard from '@/components/CategoryCard'

const CATEGORY_ORDER = ['esquis', 'botas_esqui', 'pantalones', 'snowboards', 'cascos', 'parkas']

const CATEGORY_IMAGES: Record<string, string> = {
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

export default async function CategoriesSection() {
  const supabase = createServerSupabaseClient()

  const { data: allProducts } = await supabase
    .from('products')
    .select('product_type')
    .eq('status', 'approved')

  const categoryCounts: Record<string, number> = {}
  allProducts?.forEach(p => {
    categoryCounts[p.product_type] = (categoryCounts[p.product_type] || 0) + 1
  })

  const topCategories = CATEGORY_ORDER
    .filter(type => categoryCounts[type])
    .map(type => [type, categoryCounts[type]] as [string, number])

  if (topCategories.length === 0) return null

  return (
    <section className="max-w-[1000px] mx-auto px-4 md:px-6 pt-6 md:pt-10 pb-12 md:pb-20">
      <h2 className="font-body text-sm font-medium tracking-widest uppercase text-gray-400 mb-8">
        Categorias
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {topCategories.map(([type, count]) => (
          <CategoryCard
            key={type}
            type={type}
            label={PRODUCT_TYPES[type] || type}
            count={count}
            image={CATEGORY_IMAGES[type] || CATEGORY_IMAGES.otros}
            imagePosition={type === 'pantalones' ? 'object-[center_70%]' : undefined}
            darkOverlay={type === 'pantalones'}
          />
        ))}
      </div>
    </section>
  )
}
