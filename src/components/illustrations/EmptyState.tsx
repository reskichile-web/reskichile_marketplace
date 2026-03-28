import Link from 'next/link'

interface Props {
  title?: string
  description?: string
  actionLabel?: string
  actionHref?: string
}

export default function EmptyState({
  title = 'No encontramos nada',
  description = 'Intenta ajustar los filtros o vuelve mas tarde.',
  actionLabel,
  actionHref,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Ski in snow illustration */}
      <svg viewBox="0 0 120 100" fill="none" className="w-28 h-28 text-gray-300 mb-6">
        {/* Snow mound */}
        <ellipse cx="60" cy="82" rx="50" ry="8" fill="currentColor" opacity={0.15} />

        {/* Ski stuck in snow */}
        <line x1="55" y1="20" x2="62" y2="78" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />

        {/* Ski tip */}
        <path d="M53 18 Q55 14 57 18" stroke="currentColor" strokeWidth={2} strokeLinecap="round" fill="none" />

        {/* Pole */}
        <line x1="70" y1="30" x2="66" y2="76" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" opacity={0.5} />
        <circle cx="70" cy="30" r="2" stroke="currentColor" strokeWidth={1} fill="none" opacity={0.4} />

        {/* Snow dots */}
        <circle cx="35" cy="75" r="1.5" fill="currentColor" opacity={0.1} />
        <circle cx="80" cy="78" r="1" fill="currentColor" opacity={0.1} />
        <circle cx="45" cy="80" r="2" fill="currentColor" opacity={0.08} />
        <circle cx="90" cy="76" r="1.5" fill="currentColor" opacity={0.08} />

        {/* Snowflakes */}
        <circle cx="30" cy="40" r="1.5" fill="currentColor" opacity={0.12}>
          <animate attributeName="cy" values="40;50;40" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="85" cy="35" r="1" fill="currentColor" opacity={0.1}>
          <animate attributeName="cy" values="35;48;35" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx="50" cy="30" r="1" fill="currentColor" opacity={0.08}>
          <animate attributeName="cy" values="30;42;30" dur="3.5s" repeatCount="indefinite" />
        </circle>
      </svg>

      <h3 className="font-body text-lg font-black text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-400 max-w-xs">{description}</p>

      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="pressable mt-6 bg-brand-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
