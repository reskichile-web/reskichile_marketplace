import { Skeleton } from '@/components/ui/skeleton'

export default function AdminTableSkeleton({ title = 'Cargando...' }: { title?: string }) {
  return (
    <div className="max-w-7xl mx-auto mt-0 px-8 pt-4 pb-16">
      <div className="mb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-40 mt-2" />
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg hidden sm:block" />
          <Skeleton className="h-10 w-40 rounded-lg hidden sm:block" />
        </div>
      </div>

      {/* Count */}
      <Skeleton className="h-4 w-24 mb-3" />

      {/* Table */}
      <div className="overflow-x-auto">
        <div className="border-b pb-2 flex gap-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16 hidden sm:block" />
          <Skeleton className="h-4 w-20 hidden md:block" />
          <Skeleton className="h-4 w-16 hidden md:block" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-b py-3 flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20 sm:hidden" />
              </div>
            </div>
            <Skeleton className="h-4 w-20 hidden sm:block" />
            <Skeleton className="h-4 w-24 hidden md:block" />
            <Skeleton className="h-4 w-20 hidden md:block" />
            <Skeleton className="h-6 w-20 rounded" />
            <div className="flex gap-1.5">
              <Skeleton className="h-7 w-16 rounded" />
              <Skeleton className="h-7 w-14 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
