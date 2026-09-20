import { createHmac } from 'crypto'

export const CONTACTED_REMINDER_CAMPAIGN = 'contacted-products-2026-09-21'
export const CONTACTED_REMINDER_LOCAL_DATE = '2026-09-21'
export const CONTACTED_REMINDER_STARTED_AT = '2026-09-21T03:00:00.000Z'

export function santiagoDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function isContactedReminderCampaignDay(now: Date): boolean {
  return santiagoDate(now) === CONTACTED_REMINDER_LOCAL_DATE
}

export function contactedProductIds(
  rows: Array<{ product_id: string | null }>,
): string[] {
  return [...new Set(rows.flatMap(row => row.product_id ? [row.product_id] : []))]
}

export function contactedReminderDeliveryKey(productId: string): string {
  return `${CONTACTED_REMINDER_CAMPAIGN}/${productId}`
}

export function contactedReminderActionTokens(
  secret: string,
  productId: string,
): { confirmSold: string; stillAvailable: string } {
  return saleReminderActionTokens(
    secret,
    contactedReminderDeliveryKey(productId),
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
