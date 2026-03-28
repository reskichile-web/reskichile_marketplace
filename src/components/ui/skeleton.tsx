import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-gradient-to-r from-gray-100 via-brand-50/40 to-gray-100 bg-[length:200%_100%] animate-shimmer rounded-md',
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
