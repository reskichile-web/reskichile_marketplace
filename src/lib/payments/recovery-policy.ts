// A fresh, correlated provider response is required before this policy is used.
// This grace period exceeds Webpay's payment form and confirmation windows.
export const INITIALIZED_GRACE_MS = 30 * 60 * 1000

export interface RecoveryContext {
  created_at: string
  commit_started_at: string | null
}

export function initializedPaymentExpired(
  context: RecoveryContext | undefined,
  now = Date.now(),
): boolean {
  if (!context) return false
  const created = Date.parse(context.created_at)
  const commit = context.commit_started_at ? Date.parse(context.commit_started_at) : created
  if (!Number.isFinite(created) || !Number.isFinite(commit)) return false
  return now - Math.max(created, commit) >= INITIALIZED_GRACE_MS
}
