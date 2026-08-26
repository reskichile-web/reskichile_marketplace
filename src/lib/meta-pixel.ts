const META_PIXEL_ID = '1033239198909712'
const META_PIXEL_SCRIPT_ID = 'meta-pixel-library'

type MetaPixelFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[][]
  loaded: boolean
  version: string
  push: (...args: unknown[]) => void
}

declare global {
  interface Window {
    fbq?: MetaPixelFunction
    _fbq?: MetaPixelFunction
    __reskiMetaPixelInitialized?: boolean
    __reskiMetaLastPageView?: string
  }
}

function ensureMetaQueue(): MetaPixelFunction {
  if (window.fbq) return window.fbq

  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue.push(args)
  } as MetaPixelFunction

  fbq.push = (...args: unknown[]) => fbq(...args)
  fbq.loaded = true
  fbq.version = '2.0'
  fbq.queue = []
  window.fbq = fbq
  window._fbq = fbq
  return fbq
}

export function loadMetaPixel(): void {
  if (typeof window === 'undefined') return

  const fbq = ensureMetaQueue()
  if (!window.__reskiMetaPixelInitialized) {
    fbq('init', META_PIXEL_ID)
    // Meta's automatic button classification produced false subscription
    // events from product-gallery thumbnails. Only explicit Reski events run.
    fbq('set', 'autoConfig', false, META_PIXEL_ID)
    window.__reskiMetaPixelInitialized = true
  }
  // This must also run after a user changes their choice from denied to granted.
  fbq('consent', 'grant')

  if (!document.getElementById(META_PIXEL_SCRIPT_ID)) {
    const script = document.createElement('script')
    script.id = META_PIXEL_SCRIPT_ID
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(script)
  }
}

export function trackMetaPageView(path: string): void {
  if (!window.fbq || window.__reskiMetaLastPageView === path) return
  window.__reskiMetaLastPageView = path
  window.fbq('track', 'PageView')
}

export function revokeMetaPixel(): void {
  if (typeof window === 'undefined') return
  window.fbq?.('consent', 'revoke')
  window.__reskiMetaLastPageView = undefined

  for (const name of ['_fbp', '_fbc']) {
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`
    document.cookie = `${name}=; Max-Age=0; path=/; domain=.reskichile.cl; SameSite=Lax`
  }
}
