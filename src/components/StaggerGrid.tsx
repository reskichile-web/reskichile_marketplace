interface GridProps {
  children: React.ReactNode
  className?: string
}

// Entrance animation via CSS (tailwindcss-animate) instead of framer-motion —
// visually equivalent to the old stagger but ships zero animation JS, so the
// home product grid no longer pulls framer-motion into the bundle for anyone.
export function StaggerGrid({ children, className }: GridProps) {
  return (
    <div
      className={`${className || 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5'} animate-in fade-in slide-in-from-bottom-2 duration-500`}
    >
      {children}
    </div>
  )
}

export function StaggerItem({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
