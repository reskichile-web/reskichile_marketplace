export const SALE_REMINDER_INTERVAL_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

interface SaleReminderTiming {
  status: string
  daysPublished: number
  lastReminderAt: string | null
}

/**
 * Mirrors the cron eligibility rules: the listing must be approved, have at
 * least 30 published days, and be 30 days past the latest reminder/reset.
 */
export function daysUntilSaleReminder(
  timing: SaleReminderTiming,
  now = Date.now(),
): number | null {
  if (timing.status !== 'approved') return null

  const daysUntilPublishedThreshold = Math.max(
    0,
    SALE_REMINDER_INTERVAL_DAYS - Math.max(0, timing.daysPublished),
  )

  if (!timing.lastReminderAt) return daysUntilPublishedThreshold

  const lastReminderMs = Date.parse(timing.lastReminderAt)
  if (!Number.isFinite(lastReminderMs)) return daysUntilPublishedThreshold

  const nextReminderMs = lastReminderMs + SALE_REMINDER_INTERVAL_DAYS * DAY_MS
  const daysUntilResetThreshold = Math.max(0, Math.ceil((nextReminderMs - now) / DAY_MS))

  return Math.max(daysUntilPublishedThreshold, daysUntilResetThreshold)
}

export function saleReminderCutoff(now = Date.now()): string {
  return new Date(now - SALE_REMINDER_INTERVAL_DAYS * DAY_MS).toISOString()
}
