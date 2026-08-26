import { Skeleton } from '@/components/ui/skeleton'

export default function CatalogSkeleton() {
  return (
    <div className="mx-auto max-w-[1600px] px-5 pb-24 pt-6 md:px-10 md:pt-10">
      <div className="mb-8 md:mb-10">
        <Skeleton className="h-11 w-52 rounded-none md:h-14 md:w-64" />
        <Skeleton className="mt-3 h-5 w-full max-w-md rounded-none" />
      </div>

      <div className="mb-6 flex items-center justify-between lg:hidden">
        <Skeleton className="h-10 w-28 rounded-full" />
        <Skeleton className="h-8 w-40 rounded-none" />
      </div>

      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-12">
        <aside className="hidden space-y-5 lg:block">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="border-t border-gray-200 pt-4">
              <Skeleton className="h-4 w-24 rounded-none" />
              {index === 0 && (
                <div className="mt-4 flex gap-2">
                  <Skeleton className="h-9 flex-1 rounded-none" />
                  <Skeleton className="h-9 flex-1 rounded-none" />
                </div>
              )}
            </div>
          ))}
        </aside>

        <div className="min-w-0">
          <div className="mb-6 hidden items-center justify-between lg:flex">
            <Skeleton className="h-4 w-24 rounded-none" />
            <Skeleton className="h-8 w-40 rounded-none" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index}>
                <Skeleton className="aspect-[4/5] rounded-none" />
                <Skeleton className="mt-3 h-3 w-16 rounded-none" />
                <Skeleton className="mt-2 h-4 w-3/4 rounded-none" />
                <Skeleton className="mt-2 h-5 w-24 rounded-none" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
