export default function SuccessCheck({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <div className={className}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        {/* Background circle */}
        <circle cx="32" cy="32" r="30" fill="#f0fdf4" />
        <circle cx="32" cy="32" r="30" stroke="#22c55e" strokeWidth={1.5} opacity={0.3}>
          <animate attributeName="r" values="28;30;28" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* Checkmark with draw animation */}
        <path
          d="M20 33 L28 41 L44 23"
          stroke="#22c55e"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray="40"
          strokeDashoffset="40"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="40"
            to="0"
            dur="0.5s"
            fill="freeze"
            begin="0.2s"
          />
        </path>
      </svg>
    </div>
  )
}
