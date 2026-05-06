'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

interface Props {
  header: React.ReactNode
  footer: React.ReactNode
  children: React.ReactNode
}

/**
 * Wraps the global chrome (sticky header, header spacer, footer) so the
 * mobile chat views can take the full viewport. On any /mensajes/<id> or
 * /mensajes/nuevo route we hide the chrome below md and lock body scroll
 * — the chat itself uses h-[100dvh] to fill the screen exactly.
 */
export default function LayoutChrome({ header, footer, children }: Props) {
  const pathname = usePathname()
  const isFullscreenChatRoute =
    pathname === '/mensajes/nuevo' ||
    (pathname.startsWith('/mensajes/') && pathname !== '/mensajes')

  // Lock body scroll while the user is on a fullscreen chat (mobile only).
  useEffect(() => {
    if (!isFullscreenChatRoute) return
    const mq = window.matchMedia('(max-width: 767px)')
    const original = document.body.style.overflow
    function apply() {
      document.body.style.overflow = mq.matches ? 'hidden' : original
    }
    apply()
    mq.addEventListener('change', apply)
    return () => {
      mq.removeEventListener('change', apply)
      document.body.style.overflow = original
    }
  }, [isFullscreenChatRoute])

  return (
    <>
      <div className={isFullscreenChatRoute ? 'hidden md:block' : 'contents'}>
        {header}
        <div className="h-[95px] md:h-[130px]" />
      </div>
      <main className={`flex-1 ${isFullscreenChatRoute ? '' : 'min-h-[calc(100vh-95px)] md:min-h-[calc(100vh-130px)]'}`}>
        {children}
      </main>
      <div className={isFullscreenChatRoute ? 'hidden md:block' : 'contents'}>
        {footer}
      </div>
    </>
  )
}
