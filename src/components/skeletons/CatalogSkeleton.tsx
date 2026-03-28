import { Skeleton } from '@/components/ui/skeleton'
import { ProductGridSkeleton } from './ProductCardSkeleton'

function FilterGroupSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-16" />
      <div className="space-y-1.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" style={{ width: `${60 + (i * 7) % 40}%` }} />
        ))}
      </div>
    </div>
  )
}

export default function CatalogSkeleton() {
  return (
    <div className="pb-24">
      {/* Banner skeleton */}
      <div className="-mt-[95px] md:-mt-[131px] h-[220px] md:h-[320px]">
        <Skeleton className="w-full h-full rounded-none" />
      </div>

      {/* Content container */}
      <div className="relative -mt-10 md:-mt-14">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-white rounded-t-2xl shadow-sm">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-5 md:px-8 py-4 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="hidden md:flex items-center gap-1.5">
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-24 rounded-full" />
              </div>
            </div>

            {/* Mobile filter */}
            <div className="md:hidden px-5 pt-3">
              <Skeleton className="h-10 w-28 rounded-lg" />
            </div>

            <div className="flex gap-6 px-5 md:px-8 pt-4 pb-8">
              {/* Sidebar — desktop */}
              <aside className="hidden md:block w-52 shrink-0">
                <div className="space-y-6">
                  <FilterGroupSkeleton lines={6} />
                  <FilterGroupSkeleton lines={5} />
                  <FilterGroupSkeleton lines={6} />
                  <FilterGroupSkeleton lines={5} />
                </div>
              </aside>

              {/* Grid */}
              <div className="flex-1 min-w-0">
                <ProductGridSkeleton count={8} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
