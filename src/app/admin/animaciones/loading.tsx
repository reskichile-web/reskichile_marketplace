import { Skeleton } from '@/components/ui/skeleton'

export default function AnimacionesLoading() {
  return (
    <div className="max-w-7xl mx-auto mt-0 px-8 pt-4 pb-16">
      <div className="mb-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl mb-6" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
