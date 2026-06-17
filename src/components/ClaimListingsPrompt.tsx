'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { reclaimListingsUrl } from '@/lib/owner'

interface Props {
  className?: string
  /** When the caller already knows the auth state, pass it. Otherwise this
   *  component resolves it client-side (a local getSession()), so the host page
   *  can stay ISR-cacheable without reading cookies on the server. */
  isLoggedIn?: boolean
}

export default function ClaimListingsPrompt({ className, isLoggedIn }: Props) {
  const [loggedIn, setLoggedIn] = useState(!!isLoggedIn)

  useEffect(() => {
    if (isLoggedIn !== undefined) return // caller already resolved it
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session))
  }, [isLoggedIn])

  const href = loggedIn ? reclaimListingsUrl() : '/auth/login?redirect=/perfil'
  const external = loggedIn

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
