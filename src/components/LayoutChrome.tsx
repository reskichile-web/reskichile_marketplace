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
  const isAdminRoute = pathname.startsWith('/admin')
  const isCheckoutRoute = pathname === '/checkout'
  const hidesMarketplaceChrome = isAdminRoute || isCheckoutRoute

  // Lock html/body to the dynamic viewport on a fullscreen chat (mobile only),
  // otherwise body's min-h-screen (100vh) leaves a gap below the chat (which
  // uses 100dvh) when the browser chrome retracts.
  useEffect(() => {
    if (!isFullscreenChatRoute) return
    const html = document.documentElement
    const body = document.body
    const mq = window.matchMedia('(max-width: 767px)')

    const previous = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      bodyMinHeight: body.style.minHeight,
    }

    function apply() {
      if (mq.matches) {
        html.style.overflow = 'hidden'
        html.style.height = '100dvh'
        body.style.overflow = 'hidden'
        body.style.height = '100dvh'
        body.style.minHeight = '100dvh'
      } else {
        html.style.overflow = previous.htmlOverflow
        html.style.height = previous.htmlHeight
        body.style.overflow = previous.bodyOverflow
        body.style.height = previous.bodyHeight
        body.style.minHeight = previous.bodyMinHeight
      }
    }
    apply()
    mq.addEventListener('change', apply)
    return () => {
      mq.removeEventListener('change', apply)
      html.style.overflow = previous.htmlOverflow
      html.style.height = previous.htmlHeight
      body.style.overflow = previous.bodyOverflow
      body.style.height = previous.bodyHeight
      body.style.minHeight = previous.bodyMinHeight
    }
  }, [isFullscreenChatRoute])

  return (
    <>
      {!hidesMarketplaceChrome && (
        <div className={isFullscreenChatRoute ? 'hidden md:block' : 'contents'}>
          {header}
          <div className="h-[60px] md:h-[130px]" />
        </div>
      )}
      <main className={`flex-1 ${isFullscreenChatRoute || hidesMarketplaceChrome ? '' : 'min-h-[calc(100vh-60px)] md:min-h-[calc(100vh-130px)]'}`}>
        {children}
      </main>
      {!hidesMarketplaceChrome && (
        <div className={isFullscreenChatRoute ? 'hidden md:block' : 'contents'}>
          {footer}
        </div>
      )}
    </>
  )
}
