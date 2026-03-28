import { Skeleton } from '@/components/ui/skeleton'

export default function ProductDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 pb-16">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Image */}
        <div>
          <Skeleton className="aspect-[4/5] rounded-lg" />
          <div className="flex justify-center gap-1.5 mt-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="w-2 h-2 rounded-full" />
            ))}
          </div>
        </div>

        {/* Info */}
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-9 w-3/4 mb-3" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>

          {/* Condition scale */}
          <div className="mt-6">
            <Skeleton className="h-3 w-32 mb-3" />
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="flex-1 h-16 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Attributes */}
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded" />
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="mt-6 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>

          {/* CTA */}
          <Skeleton className="w-full h-12 rounded-lg mt-6" />
        </div>
      </div>
    </div>
  )
}
