import { createHmac } from 'crypto'

export const APPROVED_REMINDER_CAMPAIGN = 'approved-products-2026-09-21'
export const APPROVED_REMINDER_LOCAL_DATE = '2026-09-21'
export const APPROVED_REMINDER_PREVIOUS_DAY_STARTED_AT = '2026-09-20T03:00:00.000Z'
export const APPROVED_REMINDER_STARTED_AT = '2026-09-21T03:00:00.000Z'

export function santiagoDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function isApprovedReminderCampaignDay(now: Date): boolean {
  return santiagoDate(now) === APPROVED_REMINDER_LOCAL_DATE
}

export function isApprovedReminderCandidate(
  saleReminderSentAt: string | null | undefined,
): boolean {
  if (!saleReminderSentAt) return true

  const sentAt = Date.parse(saleReminderSentAt)
  if (!Number.isFinite(sentAt)) return true

  // At send time this excludes only the immediately preceding Chilean day,
  // plus anything already sent on campaign day (including an idempotent retry).
  if (sentAt >= Date.parse(APPROVED_REMINDER_STARTED_AT)) return false
  return sentAt < Date.parse(APPROVED_REMINDER_PREVIOUS_DAY_STARTED_AT)
}

export function approvedReminderDeliveryKey(productId: string): string {
  return `${APPROVED_REMINDER_CAMPAIGN}/${productId}`
}

export function approvedReminderActionTokens(
  secret: string,
  productId: string,
): { confirmSold: string; stillAvailable: string } {
  return saleReminderActionTokens(
    secret,
    approvedReminderDeliveryKey(productId),
  )
}

export function saleReminderActionTokens(
  secret: string,
  deliveryKey: string,
): { confirmSold: string; stillAvailable: string } {
  const token = (action: 'confirm_sold' | 'still_available'): string => (
    createHmac('sha256', secret)
      .update(`${deliveryKey}:${action}`)
      .digest('hex')
  )
  return {
    confirmSold: token('confirm_sold'),
    stillAvailable: token('still_available'),
  }
}
