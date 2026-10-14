import { describe, expect, it } from 'vitest'
import {
  SALE_REMINDER_INTERVAL_DAYS,
  daysUntilSaleReminder,
  saleReminderCutoff,
} from '@/lib/sale-reminder'

describe('sale reminder timing', () => {
  const now = Date.parse('2026-09-20T15:00:00.000Z')

  it('uses a 30-day interval for the first reminder', () => {
    expect(SALE_REMINDER_INTERVAL_DAYS).toBe(30)
    expect(daysUntilSaleReminder({
      status: 'approved',
      daysPublished: 29,
      lastReminderAt: null,
    }, now)).toBe(1)
    expect(daysUntilSaleReminder({
      status: 'approved',
      daysPublished: 30,
      lastReminderAt: null,
    }, now)).toBe(0)
  })

  it('waits 30 days after a successful reminder reset', () => {
    expect(daysUntilSaleReminder({
      status: 'approved',
      daysPublished: 90,
      lastReminderAt: '2026-08-22T15:00:00.000Z',
    }, now)).toBe(1)
    expect(saleReminderCutoff(now)).toBe('2026-08-21T15:00:00.000Z')
  })

  it('uses elapsed time after reset even when publication aging is frozen', () => {
    expect(daysUntilSaleReminder({ status: 'approved', daysPublished: 0, lastReminderAt: '2026-09-20T15:00:00.000Z' }, now)).toBe(30)
  })

  it('does not schedule reminders for non-approved products', () => {
    expect(daysUntilSaleReminder({
      status: 'sold',
      daysPublished: 90,
      lastReminderAt: null,
    }, now)).toBeNull()
  })
})
