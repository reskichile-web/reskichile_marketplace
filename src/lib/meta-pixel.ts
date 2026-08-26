const META_PIXEL_ID = '1033239198909712'
const META_PIXEL_SCRIPT_ID = 'meta-pixel-library'
const VIEW_CONTENT_DEDUPLICATION_MS = 1500

export interface MetaViewContent {
  contentId: string
  contentName: string
  category: string
  value: number
}

interface PendingViewContent extends MetaViewContent {
  path: string
}

let metaConsentGranted = false
let pendingViewContent: PendingViewContent | null = null
let lastViewContent: { key: string; sentAt: number } | null = null

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
  metaConsentGranted = true

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
  flushPendingMetaEvents(path)
}

function sendMetaViewContent(event: PendingViewContent): void {
  if (!window.fbq) return

  const key = `${event.path}:${event.contentId}`
  const now = Date.now()
  if (
    lastViewContent?.key === key &&
    now - lastViewContent.sentAt < VIEW_CONTENT_DEDUPLICATION_MS
  ) return

  lastViewContent = { key, sentAt: now }
  window.fbq('track', 'ViewContent', {
    content_ids: [event.contentId],
    content_name: event.contentName,
    content_category: event.category,
    content_type: 'product',
    value: event.value,
    currency: 'CLP',
  })
}

export function trackMetaViewContent(event: MetaViewContent): void {
  if (typeof window === 'undefined') return

  const pending = { ...event, path: window.location.pathname }
  if (
    !metaConsentGranted ||
    !window.fbq ||
    window.__reskiMetaLastPageView !== pending.path
  ) {
    pendingViewContent = pending
    return
  }

  sendMetaViewContent(pending)
}

function flushPendingMetaEvents(path: string): void {
  if (!metaConsentGranted || !window.fbq || !pendingViewContent) return

  const pending = pendingViewContent
  pendingViewContent = null
  if (pending.path === path) sendMetaViewContent(pending)
}

export function revokeMetaPixel(): void {
  if (typeof window === 'undefined') return
  window.fbq?.('consent', 'revoke')
  metaConsentGranted = false
  window.__reskiMetaLastPageView = undefined

  for (const name of ['_fbp', '_fbc']) {
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`
    document.cookie = `${name}=; Max-Age=0; path=/; domain=.reskichile.cl; SameSite=Lax`
  }
}
