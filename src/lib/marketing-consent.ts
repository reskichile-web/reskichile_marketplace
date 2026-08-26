export const MARKETING_CONSENT_KEY = 'reski:marketing-consent'
export const MARKETING_CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000

export type MarketingConsentChoice = 'granted' | 'denied'

interface StoredMarketingConsent {
  choice: MarketingConsentChoice
  decidedAt: number
}

export function parseMarketingConsent(
  raw: string | null,
  now = Date.now(),
): MarketingConsentChoice | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<StoredMarketingConsent>
    if (parsed.choice !== 'granted' && parsed.choice !== 'denied') return null
    if (typeof parsed.decidedAt !== 'number' || !Number.isFinite(parsed.decidedAt)) return null
    if (parsed.decidedAt > now || now - parsed.decidedAt > MARKETING_CONSENT_MAX_AGE_MS) return null
    return parsed.choice
  } catch {
    return null
  }
}

export function serializeMarketingConsent(
  choice: MarketingConsentChoice,
  decidedAt = Date.now(),
): string {
  return JSON.stringify({ choice, decidedAt } satisfies StoredMarketingConsent)
}
