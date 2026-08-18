export const revalidate = 60

import { Suspense } from 'react'
import HomeHero from '@/components/home/HomeHero'
import ProductsSection from '@/components/home/ProductsSection'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductGridSkeleton } from '@/components/skeletons/ProductCardSkeleton'

function ProductsSkeleton() {
  return (
    <section className="max-w-7xl mx-auto px-4">
      <div className="py-3 md:py-4 border-b border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-8" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-16 rounded-full md:hidden" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="hidden md:block h-8 w-24 rounded-full" />
            ))}
          </div>
        </div>
      </div>
      <ProductGridSkeleton count={8} />
    </section>
  )
}

export default function HomePage() {
  return (
    <div className="relative">
      <HomeHero />

      {/* Products — streams in with skeleton fallback */}
      <Suspense fallback={<ProductsSkeleton />}>
        <ProductsSection />
      </Suspense>
    </div>
  )
}
