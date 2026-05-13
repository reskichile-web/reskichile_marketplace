import { reclaimListingsUrl } from '@/lib/owner'

interface Props {
  className?: string
  isLoggedIn?: boolean
}

export default function ClaimListingsPrompt({ className, isLoggedIn = false }: Props) {
  const href = isLoggedIn ? reclaimListingsUrl() : '/auth/login?redirect=/perfil'
  const external = isLoggedIn

  return (
    <div className={`text-center ${className || ''}`}>
      <p className="text-[clamp(11px,2.6vw,14px)] font-semibold tracking-wide uppercase text-gray-600">
        ¿Reski publicó un producto tuyo?
      </p>
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="mt-1 inline-block text-[clamp(11px,2.6vw,14px)] text-brand-500 underline underline-offset-2 hover:text-brand-600"
      >
        Vincúlalo a tu cuenta
      </a>
    </div>
  )
}
