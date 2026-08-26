export const CAMPAIGN_ATTRIBUTION_KEY = 'reski:campaign-attribution'
export const CAMPAIGN_ATTRIBUTION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

const UTM_FIELDS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const

type UtmField = (typeof UTM_FIELDS)[number]

export interface CampaignAttribution extends Partial<Record<UtmField, string>> {
  attribution_at: string
}

function cleanValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200)
  return cleaned || undefined
}

function normalizeAttribution(value: unknown, now = Date.now()): CampaignAttribution | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const input = value as Record<string, unknown>
  const timestamp = Date.parse(typeof input.attribution_at === 'string' ? input.attribution_at : '')
  if (
    !Number.isFinite(timestamp) ||
    timestamp > now + MAX_CLOCK_SKEW_MS ||
    now - timestamp > CAMPAIGN_ATTRIBUTION_MAX_AGE_MS
  ) return null

  const attribution: CampaignAttribution = {
    attribution_at: new Date(timestamp).toISOString(),
  }
  for (const field of UTM_FIELDS) {
    const cleaned = cleanValue(input[field])
    if (cleaned) attribution[field] = cleaned
  }

  return UTM_FIELDS.some((field) => attribution[field]) ? attribution : null
}

export function campaignAttributionFromSearch(
  search: string,
  now = Date.now(),
): CampaignAttribution | null {
  const params = new URLSearchParams(search)
  const attribution: CampaignAttribution = {
    attribution_at: new Date(now).toISOString(),
  }

  for (const field of UTM_FIELDS) {
    const cleaned = cleanValue(params.get(field))
    if (cleaned) attribution[field] = cleaned
  }

  return UTM_FIELDS.some((field) => attribution[field]) ? attribution : null
}

export function parseCampaignAttribution(
  raw: string | null,
  now = Date.now(),
): CampaignAttribution | null {
  if (!raw) return null
  try {
    return normalizeAttribution(JSON.parse(raw) as unknown, now)
  } catch {
    return null
  }
}

export function sanitizeCampaignAttribution(
  value: unknown,
  now = Date.now(),
): CampaignAttribution | null {
  return normalizeAttribution(value, now)
}

/**
 * Last non-direct attribution: a direct visit never overwrites a campaign.
 * The same browser value survives login and internal navigation for 30 days.
 */
export function getCampaignAttribution(now = Date.now()): CampaignAttribution | null {
  if (typeof window === 'undefined') return null

  const current = campaignAttributionFromSearch(window.location.search, now)
  if (current) {
    try {
      window.localStorage.setItem(CAMPAIGN_ATTRIBUTION_KEY, JSON.stringify(current))
    } catch {
      // Current-page attribution remains usable if storage is unavailable.
    }
    return current
  }

  try {
    const stored = parseCampaignAttribution(
      window.localStorage.getItem(CAMPAIGN_ATTRIBUTION_KEY),
      now,
    )
    if (!stored) window.localStorage.removeItem(CAMPAIGN_ATTRIBUTION_KEY)
    return stored
  } catch {
    return null
  }
}
