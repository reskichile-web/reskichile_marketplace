import { describe, expect, it } from 'vitest'
import {
  summarizeCookieConsentEvents,
  type CookieConsentEvent,
} from '@/lib/admin-consent-metrics'

const visitor = (suffix: number) => `97000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`

describe('cookie consent metrics', () => {
  it('counts each visitor under their latest choice and retains raw decisions', () => {
    const events: CookieConsentEvent[] = [
      { id: 1, event_name: 'cookie_consent_granted', visitor_id: visitor(1), created_at: '2026-08-20T10:00:00Z' },
      { id: 2, event_name: 'cookie_consent_denied', visitor_id: visitor(1), created_at: '2026-08-21T10:00:00Z' },
      { id: 3, event_name: 'cookie_consent_granted', visitor_id: visitor(2), created_at: '2026-08-21T10:00:00Z' },
      { id: 4, event_name: 'cookie_consent_granted', visitor_id: visitor(3), created_at: '2026-08-21T10:00:00Z' },
      { id: 5, event_name: 'cookie_consent_granted', visitor_id: visitor(3), created_at: '2026-08-22T10:00:00Z' },
    ]

    expect(summarizeCookieConsentEvents(events)).toEqual([
      { decision: 'granted', unique_visitors: 2, decisions: 4 },
      { decision: 'denied', unique_visitors: 1, decisions: 1 },
    ])
  })

  it('returns explicit zero rows before the first recorded choice', () => {
    expect(summarizeCookieConsentEvents([])).toEqual([
      { decision: 'granted', unique_visitors: 0, decisions: 0 },
      { decision: 'denied', unique_visitors: 0, decisions: 0 },
    ])
  })
})
