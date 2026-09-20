import { describe, expect, it } from 'vitest'
import {
  SALE_REMINDER_INTERVAL_DAYS,
  daysUntilSaleReminder,
  saleReminderCutoff,
} from '@/lib/sale-reminder'

describe('sale reminder timing', () => {
  const now = Date.parse('2026-09-20T15:00:00.000Z')

  it('uses a 15-day interval for the first reminder', () => {
    expect(SALE_REMINDER_INTERVAL_DAYS).toBe(15)
    expect(daysUntilSaleReminder({
      status: 'approved',
      daysPublished: 14,
      lastReminderAt: null,
    }, now)).toBe(1)
    expect(daysUntilSaleReminder({
      status: 'approved',
      daysPublished: 15,
      lastReminderAt: null,
    }, now)).toBe(0)
  })

  it('waits 15 days after a successful reminder reset', () => {
    expect(daysUntilSaleReminder({
      status: 'approved',
      daysPublished: 90,
      lastReminderAt: '2026-09-06T15:00:00.000Z',
    }, now)).toBe(1)
    expect(saleReminderCutoff(now)).toBe('2026-09-05T15:00:00.000Z')
  })

  it('does not schedule reminders for non-approved products', () => {
    expect(daysUntilSaleReminder({
      status: 'sold',
      daysPublished: 90,
      lastReminderAt: null,
    }, now)).toBeNull()
  })
})
