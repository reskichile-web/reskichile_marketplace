import { reclaimListingsUrl } from '@/lib/owner'

interface Props {
  className?: string
}

export default function ClaimListingsPrompt({ className }: Props) {
  return (
    <p
      className={`whitespace-nowrap overflow-hidden text-[clamp(10px,3vw,14px)] text-gray-600 leading-relaxed ${className || ''}`}
    >
      ¿Subimos un producto a tu nombre?{' '}
      <a
        href={reclaimListingsUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-500 underline underline-offset-2 hover:text-brand-600"
      >
        Sumalo a tu cuenta
      </a>
      .
    </p>
  )
}
