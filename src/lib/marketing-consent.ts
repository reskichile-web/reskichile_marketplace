export const MARKETING_CONSENT_KEY = 'reski:marketing-consent'
export const MARKETING_CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000
export const MARKETING_CONSENT_VERSION = 1

export type MarketingConsentChoice = 'granted' | 'denied'

export interface MarketingConsentDecision {
  choice: MarketingConsentChoice
  version: number
  decidedAt: number
}

export interface StoredMarketingConsent extends MarketingConsentDecision {
  userId?: string
}

function parseDecision(value: unknown): MarketingConsentDecision | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const parsed = value as Partial<MarketingConsentDecision>
  if (parsed.choice !== 'granted' && parsed.choice !== 'denied') return null
  if (parsed.version !== MARKETING_CONSENT_VERSION) return null
  if (typeof parsed.decidedAt !== 'number' || !Number.isFinite(parsed.decidedAt)) return null

  return {
    choice: parsed.choice,
    version: parsed.version,
    decidedAt: parsed.decidedAt,
  }
}

export function createMarketingConsentDecision(
  choice: MarketingConsentChoice,
  decidedAt = Date.now(),
): MarketingConsentDecision {
  return { choice, version: MARKETING_CONSENT_VERSION, decidedAt }
}

export function parseStoredMarketingConsent(
  raw: string | null,
  now = Date.now(),
): StoredMarketingConsent | null {
  if (!raw) return null

  try {
    const value = JSON.parse(raw) as unknown
    const decision = parseDecision(value)
    if (!decision) return null
    if (decision.decidedAt > now || now - decision.decidedAt > MARKETING_CONSENT_MAX_AGE_MS) return null

    const userId = typeof (value as { userId?: unknown }).userId === 'string'
      ? (value as { userId: string }).userId
      : undefined
    return userId ? { ...decision, userId } : decision
  } catch {
    return null
  }
}

export function parseMarketingConsent(
  raw: string | null,
  now = Date.now(),
): MarketingConsentChoice | null {
  return parseStoredMarketingConsent(raw, now)?.choice ?? null
}

export function parseAccountMarketingConsent(value: unknown): MarketingConsentDecision | null {
  const decision = parseDecision(value)
  if (!decision || decision.decidedAt > Date.now()) return null
  return decision
}

export function serializeMarketingConsent(
  choice: MarketingConsentChoice,
  decidedAt = Date.now(),
  userId?: string | null,
): string {
  const decision = createMarketingConsentDecision(choice, decidedAt)
  return JSON.stringify(userId ? { ...decision, userId } : decision)
}
