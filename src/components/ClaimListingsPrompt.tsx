import { reclaimListingsUrl } from '@/lib/owner'

interface Props {
  className?: string
  align?: 'left' | 'center'
}

export default function ClaimListingsPrompt({ className, align = 'left' }: Props) {
  const alignClass = align === 'center' ? 'text-center' : 'text-left'
  return (
    <p className={`text-sm text-gray-600 leading-relaxed ${alignClass} ${className || ''}`}>
      ¿Tienes productos publicados a tu nombre en ReskiChile?{' '}
      <a
        href={reclaimListingsUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-500 underline underline-offset-2 hover:text-brand-600"
      >
        Haz click aquí
      </a>{' '}
      para reclamar tu cuenta.
    </p>
  )
}
