import { Skeleton } from '@/components/ui/skeleton'

export default function PagoResultadoLoading() {
  return (
    <div className="max-w-md mx-auto mt-16 px-4 text-center">
      <Skeleton className="h-9 w-48 mx-auto mb-4" />
      <Skeleton className="h-4 w-72 mx-auto mb-8" />
      <div className="flex gap-4 justify-center">
        <Skeleton className="h-10 w-32 rounded" />
        <Skeleton className="h-10 w-24 rounded" />
      </div>
    </div>
  )
}
