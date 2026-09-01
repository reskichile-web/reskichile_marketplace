export type MetricsPeriod = 'all' | 'custom' | 7 | 14 | 30

export const METRICS_PERIODS: ReadonlyArray<{ value: MetricsPeriod; label: string }> = [
  { value: 'all', label: 'Histórico' },
  { value: 7, label: '7 días' },
  { value: 14, label: '14 días' },
  { value: 30, label: '30 días' },
  { value: 'custom', label: 'Desde fecha' },
]

const DAY_MS = 24 * 60 * 60 * 1000
const SANTIAGO_TIME_ZONE = 'America/Santiago'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function santiagoDay(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: SANTIAGO_TIME_ZONE })
}

function datePartsInSantiago(date: Date): Record<string, number> {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SANTIAGO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const values: Record<string, number> = {}
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value)
  }
  return values
}

function santiagoOffsetMs(date: Date): number {
  const parts = datePartsInSantiago(date)
  const displayedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return displayedAsUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** Converts a Chilean calendar date to the exact UTC instant at its midnight. */
export function santiagoStartOfDayIso(day: string): string {
  if (!DATE_RE.test(day)) throw new Error('Fecha inválida')
  const [year, month, date] = day.split('-').map(Number)
  const targetWallClock = Date.UTC(year, month - 1, date)
  let instant = targetWallClock

  // Re-evaluate the offset after conversion to handle Chilean DST boundaries.
  for (let attempt = 0; attempt < 3; attempt++) {
    instant = targetWallClock - santiagoOffsetMs(new Date(instant))
  }
  return new Date(instant).toISOString()
}

function shiftDateOnly(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10)
}

export function metricsPeriodRange(
  period: MetricsPeriod,
  customDate: string,
  now = new Date(),
): { since: string | null; firstDay: string | null; calendarDays: number | null } {
  if (period === 'all') return { since: null, firstDay: null, calendarDays: null }

  const today = santiagoDay(now)
  if (period === 'custom') {
    const safeDate = DATE_RE.test(customDate) && customDate <= today ? customDate : today
    const calendarDays = Math.floor(
      (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${safeDate}T00:00:00Z`)) / DAY_MS,
    ) + 1
    return {
      since: santiagoStartOfDayIso(safeDate),
      firstDay: safeDate,
      calendarDays,
    }
  }

  return {
    since: new Date(now.getTime() - period * DAY_MS).toISOString(),
    firstDay: shiftDateOnly(today, -(period - 1)),
    calendarDays: period,
  }
}

export function formatMetricsDate(day: string): string {
  if (!DATE_RE.test(day)) return day
  const [year, month, date] = day.split('-')
  return `${date}/${month}/${year}`
}
