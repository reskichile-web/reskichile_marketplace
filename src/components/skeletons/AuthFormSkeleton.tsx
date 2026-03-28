import { Skeleton } from '@/components/ui/skeleton'

export default function AuthFormSkeleton() {
  return (
    <div className="max-w-md mx-auto px-4 min-h-[calc(100vh-130px)] flex flex-col justify-center pb-6">
      <Skeleton className="h-9 w-48 mb-6" />
      <div className="space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-10 w-full rounded" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded" />
        </div>
        <Skeleton className="h-10 w-full rounded" />
      </div>
      <Skeleton className="h-4 w-40 mx-auto mt-4" />
    </div>
  )
}
