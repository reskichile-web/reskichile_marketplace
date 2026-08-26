import { getCampaignAttribution } from '@/lib/campaign-attribution'

export type TrackEventType =
  | 'pageview'
  | 'product_view'
  | 'click'
  | 'login'
  | 'signup'
  | 'invite_open'

export interface TrackPayload {
  type?: TrackEventType
  name?: string
  category?: string
  product_id?: string
  path?: string
  referrer?: string | null
}

/**
 * Fire-and-forget first-party analytics beacon → POST /api/track.
 * sendBeacon survives the navigation that usually follows a click/login,
 * so it's safe to call right before router.push / <Link> navigation.
 */
export function track(evt: TrackPayload): void {
  if (typeof window === 'undefined') return

  const attribution = getCampaignAttribution()

  const payload = JSON.stringify({
    path: evt.path ?? window.location.pathname,
    referrer: evt.referrer !== undefined ? evt.referrer : document.referrer || null,
    ...(evt.type ? { type: evt.type } : {}),
    ...(evt.name ? { name: evt.name } : {}),
    ...(evt.category ? { category: evt.category } : {}),
    ...(evt.product_id ? { product_id: evt.product_id } : {}),
    ...(attribution ?? {}),
  })

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }))
    } else {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    // tracking must never break the page
  }
}
