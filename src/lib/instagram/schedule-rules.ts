export interface InstagramStorySlotRule {
  slot: number
  time: string
}

export interface InstagramStoryDayRule {
  isoWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7
  label: string
  target: string
  window: string
  slots: InstagramStorySlotRule[]
}

export const INSTAGRAM_STORY_SLOTS_PER_DAY = 5
export const INSTAGRAM_STORY_SLOT_INTERVAL_MINUTES = 15

function slotsFrom(firstTime: string): InstagramStorySlotRule[] {
  const [hours, minutes] = firstTime.split(':').map(Number)
  const firstMinutes = hours * 60 + minutes

  return Array.from({ length: INSTAGRAM_STORY_SLOTS_PER_DAY }, (_, index) => {
    const totalMinutes = firstMinutes + index * INSTAGRAM_STORY_SLOT_INTERVAL_MINUTES
    return {
      slot: index + 1,
      time: `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`,
    }
  })
}

export const INSTAGRAM_STORY_DAY_RULES: InstagramStoryDayRule[] = [
  { isoWeekday: 1, label: 'Lunes', target: '20:30', window: '19:30–21:30', slots: slotsFrom('19:30') },
  { isoWeekday: 2, label: 'Martes', target: '20:30', window: '19:30–21:30', slots: slotsFrom('19:30') },
  { isoWeekday: 3, label: 'Miércoles', target: '20:00', window: '19:00–21:00', slots: slotsFrom('19:00') },
  { isoWeekday: 4, label: 'Jueves', target: '19:00', window: '18:00–20:30', slots: slotsFrom('18:00') },
  { isoWeekday: 5, label: 'Viernes', target: '18:30', window: '17:30–19:30', slots: slotsFrom('17:30') },
  { isoWeekday: 6, label: 'Sábado', target: '19:30', window: '18:30–21:00', slots: slotsFrom('18:30') },
  { isoWeekday: 7, label: 'Domingo', target: '20:00', window: '19:00–21:30', slots: slotsFrom('19:00') },
]

export function instagramStoryRuleForDate(localDate: string): InstagramStoryDayRule {
  const date = new Date(`${localDate}T12:00:00Z`)
  const day = date.getUTCDay()
  const isoWeekday = (day === 0 ? 7 : day) as InstagramStoryDayRule['isoWeekday']
  return INSTAGRAM_STORY_DAY_RULES[isoWeekday - 1]
}

export function isInstagramStorySlotForDate(localDate: string, slot: number): boolean {
  if (!Number.isInteger(slot) || slot < 1) return false
  const date = new Date(`${localDate}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return false
  return instagramStoryRuleForDate(localDate).slots.some((candidate) => candidate.slot === slot)
}
