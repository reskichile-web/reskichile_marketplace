import { reclaimListingsUrl } from '@/lib/owner'

interface Props {
  className?: string
  isLoggedIn?: boolean
}

export default function ClaimListingsPrompt({ className, isLoggedIn = false }: Props) {
  const href = isLoggedIn ? reclaimListingsUrl() : '/auth/login?redirect=/perfil'
  const external = isLoggedIn

  return (
    <div className={`flex flex-col items-center justify-center gap-0.5 text-center md:flex-row md:items-baseline md:gap-2 ${className || ''}`}>
      <p className="text-[11px] font-normal tracking-wide uppercase text-gray-400">
        ¿Reski publicó un producto tuyo?
      </p>
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="text-[11px] text-brand-500 underline underline-offset-2 hover:text-brand-600 whitespace-nowrap"
      >
        Vincúlalo a tu cuenta
      </a>
    </div>
  )
}
