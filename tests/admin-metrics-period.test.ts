import { describe, expect, it } from 'vitest'
import {
  formatMetricsDate,
  METRICS_PERIODS,
  metricsPeriodRange,
  santiagoStartOfDayIso,
} from '@/lib/admin-metrics-period'

describe('admin metrics periods', () => {
  it('offers historical, 7, 14, 30, and custom-date filters', () => {
    expect(METRICS_PERIODS).toEqual([
      { value: 'all', label: 'Histórico' },
      { value: 7, label: '7 días' },
      { value: 14, label: '14 días' },
      { value: 30, label: '30 días' },
      { value: 'custom', label: 'Desde fecha' },
    ])
  })

  it('builds the seven-day rolling range and seven Chilean chart days', () => {
    const now = new Date('2026-08-31T18:00:00.000Z')

    expect(metricsPeriodRange(7, '', now)).toEqual({
      since: '2026-08-24T18:00:00.000Z',
      firstDay: '2026-08-25',
      calendarDays: 7,
    })
  })

  it('starts a custom winter date at midnight in Santiago', () => {
    expect(santiagoStartOfDayIso('2026-08-31')).toBe('2026-08-31T04:00:00.000Z')
    expect(metricsPeriodRange('custom', '2026-08-25', new Date('2026-08-31T18:00:00Z')))
      .toEqual({
        since: '2026-08-25T04:00:00.000Z',
        firstDay: '2026-08-25',
        calendarDays: 7,
      })
  })

  it('uses Chilean daylight-saving time and rejects future custom dates', () => {
    expect(santiagoStartOfDayIso('2026-01-15')).toBe('2026-01-15T03:00:00.000Z')
    expect(metricsPeriodRange('custom', '2026-09-02', new Date('2026-08-31T18:00:00Z')).firstDay)
      .toBe('2026-08-31')
  })

  it('formats selected dates for metric labels', () => {
    expect(formatMetricsDate('2026-08-25')).toBe('25/08/2026')
  })
})
