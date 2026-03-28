import { Skeleton } from '@/components/ui/skeleton'

function ProductRowSkeleton() {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex gap-3">
        <Skeleton className="w-16 h-16 sm:w-24 sm:h-24 rounded shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-6 w-20 rounded shrink-0" />
          </div>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Skeleton className="h-7 w-12 rounded" />
        <Skeleton className="h-7 w-16 rounded" />
      </div>
    </div>
  )
}

export default function MisProductosSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 min-h-screen pt-10 md:pt-14 pb-20">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-10">
        <div className="flex justify-between items-center mb-8">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <ProductRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
