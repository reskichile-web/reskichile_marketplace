export default function MountainLoader({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 200 120" fill="none" className="w-full max-w-[240px] mx-auto text-brand-500">
        {/* Mountains */}
        <path d="M0 100 L40 40 L60 65 L90 25 L120 60 L150 35 L200 100 Z" fill="currentColor" opacity={0.06} />
        <path d="M0 100 L40 40 L60 65 L90 25 L120 60 L150 35 L200 100" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round" fill="none" opacity={0.2} />

        {/* Snow caps */}
        <path d="M85 30 L90 25 L95 30" stroke="currentColor" strokeWidth={1} opacity={0.15} fill="none" />
        <path d="M145 40 L150 35 L155 40" stroke="currentColor" strokeWidth={1} opacity={0.15} fill="none" />

        {/* Sun */}
        <circle cx="170" cy="25" r="8" stroke="currentColor" strokeWidth={0.8} fill="none" opacity={0.1} />

        {/* Animated skier dot */}
        <circle r="3" fill="currentColor" opacity={0.4}>
          <animateMotion
            dur="3s"
            repeatCount="indefinite"
            path="M40 40 Q50 52 60 65 Q75 45 90 25 Q105 42 120 60 Q135 47 150 35 L180 80"
          />
        </circle>

        {/* Ground line */}
        <line x1="0" y1="100" x2="200" y2="100" stroke="currentColor" strokeWidth={0.5} opacity={0.1} />
      </svg>
    </div>
  )
}
