import { Skeleton } from '@/components/ui/skeleton'

function FormFieldSkeleton() {
  return (
    <div className="space-y-1">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full rounded" />
    </div>
  )
}

export default function PerfilSkeleton() {
  return (
    <div className="max-w-md mx-auto px-4 min-h-screen pb-16">
      {/* Mobile header */}
      <div className="md:hidden -mx-4 -mt-[95px] mb-6">
        <Skeleton className="h-48 rounded-none" />
        <div className="relative -mt-12 flex flex-col items-center">
          <Skeleton className="w-24 h-24 rounded-full border-4 border-white" />
          <Skeleton className="h-5 w-32 mt-2" />
          <Skeleton className="h-4 w-44 mt-1" />
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden md:block -mx-4 -mt-[130px] mb-8">
        <Skeleton className="aspect-[16/5] max-h-[230px] rounded-none" />
        <div className="relative -mt-10 flex items-end gap-6 max-w-md mx-auto">
          <Skeleton className="w-20 h-20 rounded-full border-4 border-white shrink-0" />
          <div className="pb-1 space-y-1.5">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-52" />
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <FormFieldSkeleton />
        <FormFieldSkeleton />
        <FormFieldSkeleton />
        <Skeleton className="h-10 w-full rounded-sm" />
      </div>
    </div>
  )
}
