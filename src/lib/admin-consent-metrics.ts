import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE_SIZE = 1_000

export type CookieConsentDecision = 'granted' | 'denied'

export interface CookieConsentMetric {
  decision: CookieConsentDecision
  unique_visitors: number
  decisions: number
}

export interface CookieConsentEvent {
  id: number
  event_name: 'cookie_consent_granted' | 'cookie_consent_denied'
  visitor_id: string
  created_at: string
}

function decisionFromEvent(eventName: CookieConsentEvent['event_name']): CookieConsentDecision {
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
  const sorted = [...events].sort((left, right) => {
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

export async function loadCookieConsentMetrics(
  supabase: SupabaseClient,
  since: string | null,
): Promise<CookieConsentMetric[]> {
  const events = new Map<number, CookieConsentEvent>()

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from('events')
      .select('id, event_name, visitor_id, created_at')
      .eq('event_type', 'click')
      .in('event_name', ['cookie_consent_granted', 'cookie_consent_denied'])
      .not('visitor_id', 'is', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
    if (since) query = query.gte('created_at', since)

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) return summarizeCookieConsentEvents([])

    const rows = (data ?? []) as CookieConsentEvent[]
    for (const row of rows) events.set(row.id, row)
    if (rows.length < PAGE_SIZE) break
  }

  return summarizeCookieConsentEvents([...events.values()])
}
