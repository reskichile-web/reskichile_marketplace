import { cn } from '@/lib/utils'

const sizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-8 h-8',
}

const colors = {
  brand: 'border-brand-500',
  white: 'border-white',
  gray: 'border-gray-400',
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
        'border-2 border-t-transparent rounded-full animate-spin',
        sizes[size],
        colors[color],
        className,
      )}
    />
  )
}
