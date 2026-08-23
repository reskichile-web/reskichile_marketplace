export interface InstagramStorySlotRule {
  slot: 1 | 2 | 3
  time: string
}

export interface InstagramStoryDayRule {
  isoWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7
  label: string
  target: string
  window: string
  slots: InstagramStorySlotRule[]
}

export const INSTAGRAM_STORY_DAY_RULES: InstagramStoryDayRule[] = [
  { isoWeekday: 1, label: 'Lunes', target: '20:30', window: '19:30–21:30', slots: [{ slot: 1, time: '19:30' }, { slot: 2, time: '20:00' }, { slot: 3, time: '20:30' }] },
  { isoWeekday: 2, label: 'Martes', target: '20:30', window: '19:30–21:30', slots: [{ slot: 1, time: '19:30' }, { slot: 2, time: '20:00' }, { slot: 3, time: '20:30' }] },
  { isoWeekday: 3, label: 'Miércoles', target: '20:00', window: '19:00–21:00', slots: [{ slot: 1, time: '19:00' }, { slot: 2, time: '19:30' }, { slot: 3, time: '20:00' }] },
  { isoWeekday: 4, label: 'Jueves', target: '19:00', window: '18:00–20:30', slots: [{ slot: 1, time: '18:00' }, { slot: 2, time: '18:30' }, { slot: 3, time: '19:00' }] },
  { isoWeekday: 5, label: 'Viernes', target: '18:30', window: '17:30–19:30', slots: [{ slot: 1, time: '17:30' }, { slot: 2, time: '18:00' }, { slot: 3, time: '18:30' }] },
  { isoWeekday: 6, label: 'Sábado', target: '19:30', window: '18:30–21:00', slots: [{ slot: 1, time: '18:30' }, { slot: 2, time: '19:00' }, { slot: 3, time: '19:30' }] },
  { isoWeekday: 7, label: 'Domingo', target: '20:00', window: '19:00–21:30', slots: [{ slot: 1, time: '19:00' }, { slot: 2, time: '19:30' }, { slot: 3, time: '20:00' }] },
]

export function instagramStoryRuleForDate(localDate: string): InstagramStoryDayRule {
  const date = new Date(`${localDate}T12:00:00Z`)
  const day = date.getUTCDay()
  const isoWeekday = (day === 0 ? 7 : day) as InstagramStoryDayRule['isoWeekday']
  return INSTAGRAM_STORY_DAY_RULES[isoWeekday - 1]
}
