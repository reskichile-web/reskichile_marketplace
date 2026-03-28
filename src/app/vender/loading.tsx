import { Skeleton } from '@/components/ui/skeleton'

export default function VenderLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-24">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <Skeleton className="h-6 w-56 mb-4" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
