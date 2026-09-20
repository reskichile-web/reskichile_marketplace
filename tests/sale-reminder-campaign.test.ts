import { describe, expect, it } from 'vitest'
import {
  APPROVED_REMINDER_CAMPAIGN,
  approvedReminderActionTokens,
  approvedReminderDeliveryKey,
  isApprovedReminderCampaignDay,
  isApprovedReminderCandidate,
  santiagoDate,
} from '@/lib/sale-reminder-campaign'

describe('approved-product reminder campaign', () => {
  it('runs only on September 21, 2026 in Chile', () => {
    expect(santiagoDate(new Date('2026-09-21T13:00:00.000Z'))).toBe('2026-09-21')
    expect(isApprovedReminderCampaignDay(new Date('2026-09-21T13:00:00.000Z'))).toBe(true)
    expect(isApprovedReminderCampaignDay(new Date('2026-09-22T03:00:00.000Z'))).toBe(false)
    expect(isApprovedReminderCampaignDay(new Date('2027-09-21T13:00:00.000Z'))).toBe(false)
  })

  it('includes old and never-reminded products but omits the previous day and retries', () => {
    expect(isApprovedReminderCandidate(null)).toBe(true)
    expect(isApprovedReminderCandidate('2026-09-19T23:59:59.999Z')).toBe(true)
    expect(isApprovedReminderCandidate('2026-09-20T03:00:00.000Z')).toBe(false)
    expect(isApprovedReminderCandidate('2026-09-21T02:59:59.999Z')).toBe(false)
    expect(isApprovedReminderCandidate('2026-09-21T13:00:00.000Z')).toBe(false)
  })

  it('derives stable, action-specific links and delivery keys', () => {
    const first = approvedReminderActionTokens('secret-value', 'product-a')
    const retry = approvedReminderActionTokens('secret-value', 'product-a')

    expect(first).toEqual(retry)
    expect(first.confirmSold).not.toBe(first.stillAvailable)
    expect(first.confirmSold).toMatch(/^[0-9a-f]{64}$/)
    expect(approvedReminderDeliveryKey('product-a')).toBe(
      `${APPROVED_REMINDER_CAMPAIGN}/product-a`,
    )
  })
})
