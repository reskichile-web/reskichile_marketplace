import { describe, expect, it } from 'vitest'
import {
  CONTACTED_REMINDER_CAMPAIGN,
  contactedProductIds,
  contactedReminderActionTokens,
  contactedReminderDeliveryKey,
  isContactedReminderCampaignDay,
  santiagoDate,
} from '@/lib/sale-reminder-campaign'

describe('contacted-product reminder campaign', () => {
  it('runs only on September 21, 2026 in Chile', () => {
    expect(santiagoDate(new Date('2026-09-21T13:00:00.000Z'))).toBe('2026-09-21')
    expect(isContactedReminderCampaignDay(new Date('2026-09-21T13:00:00.000Z'))).toBe(true)
    expect(isContactedReminderCampaignDay(new Date('2026-09-22T03:00:00.000Z'))).toBe(false)
    expect(isContactedReminderCampaignDay(new Date('2027-09-21T13:00:00.000Z'))).toBe(false)
  })

  it('deduplicates products that received multiple contacts', () => {
    expect(contactedProductIds([
      { product_id: 'product-a' },
      { product_id: 'product-a' },
      { product_id: null },
      { product_id: 'product-b' },
    ])).toEqual(['product-a', 'product-b'])
  })

  it('derives stable, action-specific links and delivery keys', () => {
    const first = contactedReminderActionTokens('secret-value', 'product-a')
    const retry = contactedReminderActionTokens('secret-value', 'product-a')

    expect(first).toEqual(retry)
    expect(first.confirmSold).not.toBe(first.stillAvailable)
    expect(first.confirmSold).toMatch(/^[0-9a-f]{64}$/)
    expect(contactedReminderDeliveryKey('product-a')).toBe(
      `${CONTACTED_REMINDER_CAMPAIGN}/product-a`,
    )
  })
})
