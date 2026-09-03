import { cn } from '@/lib/utils'

const sizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-8 h-8',
}

const colors = {
  brand: 'border-white border-t-brand-500',
  white: 'border-white/30 border-t-white',
  gray: 'border-gray-200 border-t-gray-500',
}

interface SpinnerProps {
  size?: keyof typeof sizes
  color?: keyof typeof colors
  className?: string
}

export default function Spinner({ size = 'md', color = 'brand', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2',
        sizes[size],
        colors[color],
        className,
      )}
    />
  )
}
