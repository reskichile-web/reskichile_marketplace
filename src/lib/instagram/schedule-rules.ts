export interface InstagramStorySlotRule {
  slot: number
  time: string
  kind?: 'catalog'
}

export interface InstagramStoryDayRule {
  isoWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7
  label: string
  target: string
  window: string
  slots: InstagramStorySlotRule[]
}

// Editorial blocks, not image count: a catalog sequence occupies one block.
export const INSTAGRAM_STORY_SLOTS_PER_DAY = 3
export const INSTAGRAM_STORY_SLOT_INTERVAL_MINUTES = 15
export const INSTAGRAM_STORY_CALENDAR_START_DATE = '2026-08-23'
export const INSTAGRAM_STORY_NEW_SCHEDULE_DATE = '2026-09-10'

function slotsFrom(firstTime: string, count = INSTAGRAM_STORY_SLOTS_PER_DAY): InstagramStorySlotRule[] {
  const [hours, minutes] = firstTime.split(':').map(Number)
  const firstMinutes = hours * 60 + minutes

  return Array.from({ length: count }, (_, index) => {
    const totalMinutes = firstMinutes + index * INSTAGRAM_STORY_SLOT_INTERVAL_MINUTES
    return {
      slot: index + 1,
      time: `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`,
    }
  })
}

export const INSTAGRAM_STORY_DAY_RULES: InstagramStoryDayRule[] = [
  { isoWeekday: 1, label: 'Lunes', target: '20:00', window: '19:30–20:00', slots: slotsFrom('19:30') },
  { isoWeekday: 2, label: 'Martes', target: '20:00', window: '19:30–20:00', slots: slotsFrom('19:30') },
  { isoWeekday: 3, label: 'Miércoles', target: '19:30', window: '11:30 / 12:30 · Catálogo 19:30', slots: catalogDay('19:30') },
  { isoWeekday: 4, label: 'Jueves', target: '18:30', window: '18:00–18:30', slots: slotsFrom('18:00') },
  { isoWeekday: 5, label: 'Viernes', target: '20:00', window: '11:30 / 12:30 · Catálogo 20:00', slots: catalogDay('20:00') },
  { isoWeekday: 6, label: 'Sábado', target: '19:00', window: '18:30–19:00', slots: slotsFrom('18:30') },
  { isoWeekday: 7, label: 'Domingo', target: '20:00', window: '11:30 / 12:30 · Catálogo 20:00', slots: catalogDay('20:00') },
]

function catalogDay(time: string): InstagramStorySlotRule[] {
  return [{ slot: 1, time: '11:30' }, { slot: 2, time: '12:30' }, { slot: 3, time, kind: 'catalog' }]
}

// Historical calendar rows must retain their original hours and five slots.
const LEGACY_DAY_RULES: InstagramStoryDayRule[] = [
  { isoWeekday: 1, label: 'Lunes', target: '20:30', window: '19:30–21:30', slots: slotsFrom('19:30') },
  { isoWeekday: 2, label: 'Martes', target: '20:30', window: '19:30–21:30', slots: slotsFrom('19:30') },
  { isoWeekday: 3, label: 'Miércoles', target: '20:00', window: '19:00–21:00', slots: slotsFrom('19:00') },
  { isoWeekday: 4, label: 'Jueves', target: '19:00', window: '18:00–20:30', slots: slotsFrom('18:00') },
  { isoWeekday: 5, label: 'Viernes', target: '18:30', window: '17:30–19:30', slots: slotsFrom('17:30') },
  { isoWeekday: 6, label: 'Sábado', target: '19:30', window: '18:30–21:00', slots: slotsFrom('18:30') },
  { isoWeekday: 7, label: 'Domingo', target: '20:00', window: '19:00–21:30', slots: slotsFrom('19:00') },
].map((rule) => ({ ...rule, isoWeekday: rule.isoWeekday as InstagramStoryDayRule['isoWeekday'], slots: slotsFrom(rule.slots[0].time, 5) }))

export function instagramStoryRuleForDate(localDate: string): InstagramStoryDayRule {
  const date = new Date(`${localDate}T12:00:00Z`)
  const day = date.getUTCDay()
  const isoWeekday = (day === 0 ? 7 : day) as InstagramStoryDayRule['isoWeekday']
  const rules = localDate < INSTAGRAM_STORY_NEW_SCHEDULE_DATE ? LEGACY_DAY_RULES : INSTAGRAM_STORY_DAY_RULES
  return rules[isoWeekday - 1]
}

export function isInstagramStorySlotForDate(localDate: string, slot: number): boolean {
  if (localDate < INSTAGRAM_STORY_NEW_SCHEDULE_DATE) return false
  if (!Number.isInteger(slot) || slot < 1) return false
  const date = new Date(`${localDate}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return false
  return instagramStoryRuleForDate(localDate).slots.some((candidate) => candidate.slot === slot && candidate.kind !== 'catalog')
}
