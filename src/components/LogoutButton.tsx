'use client'

import { useRef, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  children: ReactNode
  className?: string
  title?: string
  ariaLabel?: string
  onStart?: () => void
}

/**
 * Logs out through both surfaces that can hold the Supabase session:
 * the server cookie and the already-mounted browser client. The native form
 * remains as a no-JavaScript fallback and the route converts its POST to GET.
 */
export default function LogoutButton({ children, className, title, ariaLabel, onStart }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    setPending(true)
    onStart?.()

    // Permission-sensitive UI disappears synchronously, before either network
    // operation can finish or fail.
    window.dispatchEvent(new Event('reski:logout'))

    // Clear the singleton browser client first so every mounted auth listener
    // receives SIGNED_OUT while the local session still exists.
    try {
      await Promise.race([
        createClient().auth.signOut({ scope: 'local' }),
        new Promise((resolve) => window.setTimeout(resolve, 1500)),
      ])
    } catch {
      // Server-side cookie cleanup below is the final authority.
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 4000)

    try {
      await fetch('/auth/logout', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      })
    } catch {
      // The browser-side cleanup below is intentionally the final fallback.
    } finally {
      window.clearTimeout(timeout)
    }

    window.location.replace('/')
  }

  return (
    <form ref={formRef} action="/auth/logout" method="POST" onSubmit={handleSubmit}>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        aria-label={ariaLabel}
        title={title}
        className={`${className || ''} disabled:cursor-wait disabled:opacity-60`}
      >
        {children}
      </button>
    </form>
  )
}
