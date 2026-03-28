import { Skeleton } from '@/components/ui/skeleton'
import { ProductGridSkeleton } from './ProductCardSkeleton'

function FilterGroupSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-16" />
      <div className="space-y-1.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" style={{ width: `${60 + Math.random() * 40}%` }} />
        ))}
      </div>
    </div>
  )
}

export default function CatalogSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 pt-6 md:pt-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-6">
        <div className="flex items-center gap-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-16 hidden sm:block" />
          <div className="flex gap-1">
            <Skeleton className="h-8 w-20 rounded-sm" />
            <Skeleton className="h-8 w-24 rounded-sm" />
            <Skeleton className="h-8 w-24 rounded-sm" />
          </div>
        </div>
      </div>

      {/* Mobile filter button */}
      <div className="md:hidden mb-4">
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      <div className="flex gap-8">
        {/* Sidebar — desktop */}
        <aside className="hidden md:block w-64 shrink-0">
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
  )
}
