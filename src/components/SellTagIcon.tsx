import type { SVGProps } from 'react'

export default function SellTagIcon({
  className,
  strokeWidth = 1.9,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M20.6 13.1 12.7 21a2.4 2.4 0 0 1-3.4 0L3 14.7a2.4 2.4 0 0 1 0-3.4L10.9 3H19a2 2 0 0 1 2 2v8.1Z" />
      <circle cx="16.5" cy="7.5" r="1.2" />
    </svg>
  )
}
