import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE_SIZE = 1_000

export type CookieConsentDecision = 'granted' | 'denied'

export interface CookieConsentMetric {
  decision: CookieConsentDecision
  unique_visitors: number
  decisions: number
}

export type CookieConsentEventName =
  | 'cookie_consent_view'
  | 'cookie_consent_granted'
  | 'cookie_consent_denied'

export interface CookieConsentEvent {
  id: number
  event_name: CookieConsentEventName
  visitor_id: string
  created_at: string
}

export interface CookieConsentSummary {
  metrics: CookieConsentMetric[]
  /**
   * Visitors the dialog was actually shown to — the only honest denominator
   * for an acceptance rate. Counting over all visitors mixes in everyone who
   * never saw it (returning visitors, /ig-post, admins).
   */
  bannerViewers: number
  bannerViews: number
}

const DECISION_EVENTS: CookieConsentEventName[] = [
  'cookie_consent_granted',
  'cookie_consent_denied',
]

function isDecision(event: CookieConsentEvent): boolean {
  return DECISION_EVENTS.includes(event.event_name)
}

function decisionFromEvent(eventName: CookieConsentEventName): CookieConsentDecision {
  return eventName === 'cookie_consent_granted' ? 'granted' : 'denied'
}

export function summarizeCookieConsentEvents(
  events: CookieConsentEvent[],
): CookieConsentMetric[] {
  const metrics: Record<CookieConsentDecision, CookieConsentMetric> = {
    granted: { decision: 'granted', unique_visitors: 0, decisions: 0 },
    denied: { decision: 'denied', unique_visitors: 0, decisions: 0 },
  }
  const seenVisitors = new Set<string>()
  const sorted = events.filter(isDecision).sort((left, right) => {
    const byDate = Date.parse(right.created_at) - Date.parse(left.created_at)
    return byDate || right.id - left.id
  })

  for (const event of sorted) {
    const decision = decisionFromEvent(event.event_name)
    metrics[decision].decisions += 1
    if (!seenVisitors.has(event.visitor_id)) {
      seenVisitors.add(event.visitor_id)
      metrics[decision].unique_visitors += 1
    }
  }

  return [metrics.granted, metrics.denied]
}

/** Banner impressions: unique visitors shown the dialog, plus raw views. */
export function summarizeCookieConsentBannerViews(
  events: CookieConsentEvent[],
): { bannerViewers: number; bannerViews: number } {
  const viewers = new Set<string>()
  let bannerViews = 0

  for (const event of events) {
    if (event.event_name !== 'cookie_consent_view') continue
    bannerViews += 1
    viewers.add(event.visitor_id)
  }

  return { bannerViewers: viewers.size, bannerViews }
}

export function summarizeCookieConsent(events: CookieConsentEvent[]): CookieConsentSummary {
  return {
    metrics: summarizeCookieConsentEvents(events),
    ...summarizeCookieConsentBannerViews(events),
  }
}

export async function loadCookieConsentSummary(
  supabase: SupabaseClient,
  since: string | null,
): Promise<CookieConsentSummary> {
  const events = new Map<number, CookieConsentEvent>()

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from('events')
      .select('id, event_name, visitor_id, created_at')
      .eq('event_type', 'click')
      .in('event_name', ['cookie_consent_view', ...DECISION_EVENTS])
      .not('visitor_id', 'is', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
    if (since) query = query.gte('created_at', since)

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) return summarizeCookieConsent([])

    const rows = (data ?? []) as CookieConsentEvent[]
    for (const row of rows) events.set(row.id, row)
    if (rows.length < PAGE_SIZE) break
  }

  return summarizeCookieConsent([...events.values()])
}
