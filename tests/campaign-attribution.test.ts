import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CAMPAIGN_ATTRIBUTION_KEY,
  CAMPAIGN_ATTRIBUTION_MAX_AGE_MS,
  campaignAttributionFromSearch,
  getCampaignAttribution,
  parseCampaignAttribution,
  sanitizeCampaignAttribution,
} from '@/lib/campaign-attribution'

describe('campaign attribution', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('captures only supported UTM parameters', () => {
    const now = Date.UTC(2026, 7, 26)
    expect(campaignAttributionFromSearch(
      '?utm_source=meta&utm_medium=paid_social&utm_campaign=compradores_invierno_2026&utm_content=carrusel&fbclid=private-id',
      now,
    )).toEqual({
      utm_source: 'meta',
      utm_medium: 'paid_social',
      utm_campaign: 'compradores_invierno_2026',
      utm_content: 'carrusel',
      attribution_at: new Date(now).toISOString(),
    })
  })

  it('rejects expired, implausibly future, malformed, and empty attribution', () => {
    const now = Date.UTC(2026, 7, 26)
    const valid = {
      utm_source: 'meta',
      attribution_at: new Date(now).toISOString(),
    }

    expect(parseCampaignAttribution(JSON.stringify(valid), now)).toEqual(valid)
    expect(parseCampaignAttribution(JSON.stringify({
      ...valid,
      attribution_at: new Date(now - CAMPAIGN_ATTRIBUTION_MAX_AGE_MS - 1).toISOString(),
    }), now)).toBeNull()
    expect(sanitizeCampaignAttribution({
      ...valid,
      attribution_at: new Date(now + 5 * 60 * 1000).toISOString(),
    }, now)).not.toBeNull()
    expect(sanitizeCampaignAttribution({
      ...valid,
      attribution_at: new Date(now + 5 * 60 * 1000 + 1).toISOString(),
    }, now)).toBeNull()
    expect(sanitizeCampaignAttribution({ ...valid, attribution_at: 'not-a-date' }, now)).toBeNull()
    expect(sanitizeCampaignAttribution({ attribution_at: new Date(now).toISOString() }, now)).toBeNull()
  })

  it('keeps the last campaign on a later direct visit', () => {
    const now = Date.UTC(2026, 7, 26)
    const values = new Map<string, string>()
    const localStorage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
    }
    vi.stubGlobal('window', {
      location: { search: '?utm_source=meta&utm_campaign=test_meta' },
      localStorage,
    })

    const captured = getCampaignAttribution(now)
    expect(captured?.utm_campaign).toBe('test_meta')
    expect(values.has(CAMPAIGN_ATTRIBUTION_KEY)).toBe(true)

    ;(window as unknown as { location: { search: string } }).location.search = ''
    expect(getCampaignAttribution(now + 60_000)).toEqual(captured)
  })
})
