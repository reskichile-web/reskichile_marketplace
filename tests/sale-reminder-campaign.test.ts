import { describe, expect, it } from 'vitest'
import {
  APPROVED_REMINDER_CAMPAIGN,
  APPROVED_REMINDER_FOLLOWUP_CAMPAIGN,
  approvedReminderActionTokens,
  approvedReminderDeliveryKey,
  approvedReminderFollowupActionTokens,
  approvedReminderFollowupDeliveryKey,
  isApprovedReminderCampaignDay,
  isApprovedReminderCandidate,
  isApprovedReminderFollowupCandidate,
  isApprovedReminderFollowupDay,
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

  it('runs the no-response follow-up only on September 23 in Chile', () => {
    expect(isApprovedReminderFollowupDay(new Date('2026-09-23T13:00:00.000Z'))).toBe(true)
    expect(isApprovedReminderFollowupDay(new Date('2026-09-22T13:00:00.000Z'))).toBe(false)
    expect(isApprovedReminderFollowupDay(new Date('2027-09-23T13:00:00.000Z'))).toBe(false)
  })

  it('follows up only the previous campaign recipients without an available response', () => {
    expect(isApprovedReminderFollowupCandidate({
      hasPreviousCampaignToken: true,
      confirmedAvailable: false,
      saleReminderSentAt: '2026-09-21T13:00:00.000Z',
    })).toBe(true)
    expect(isApprovedReminderFollowupCandidate({
      hasPreviousCampaignToken: true,
      confirmedAvailable: true,
      saleReminderSentAt: '2026-09-21T13:00:00.000Z',
    })).toBe(false)
    expect(isApprovedReminderFollowupCandidate({
      hasPreviousCampaignToken: false,
      confirmedAvailable: false,
      saleReminderSentAt: null,
    })).toBe(false)
    expect(isApprovedReminderFollowupCandidate({
      hasPreviousCampaignToken: true,
      confirmedAvailable: false,
      saleReminderSentAt: '2026-09-23T13:00:00.000Z',
    })).toBe(false)
  })

  it('uses new stable delivery and response keys for the follow-up', () => {
    const tokens = approvedReminderFollowupActionTokens('secret-value', 'product-a')
    expect(tokens.confirmSold).not.toBe(tokens.stillAvailable)
    expect(approvedReminderFollowupDeliveryKey('product-a')).toBe(
      `${APPROVED_REMINDER_FOLLOWUP_CAMPAIGN}/product-a`,
    )
    expect(approvedReminderFollowupDeliveryKey('product-a')).not.toBe(
      approvedReminderDeliveryKey('product-a'),
    )
  })
})
