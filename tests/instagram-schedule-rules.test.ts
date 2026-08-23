import { describe, expect, it } from 'vitest'
import {
  INSTAGRAM_STORY_DAY_RULES,
  instagramStoryRuleForDate,
} from '@/lib/instagram/schedule-rules'

describe('Instagram Story schedule rules', () => {
  it('uses three half-hour slots and leaves the final Hobby delay inside each window', () => {
    expect(INSTAGRAM_STORY_DAY_RULES).toEqual([
      expect.objectContaining({ label: 'Lunes', slots: [{ slot: 1, time: '19:30' }, { slot: 2, time: '20:00' }, { slot: 3, time: '20:30' }] }),
      expect.objectContaining({ label: 'Martes', slots: [{ slot: 1, time: '19:30' }, { slot: 2, time: '20:00' }, { slot: 3, time: '20:30' }] }),
      expect.objectContaining({ label: 'Miércoles', slots: [{ slot: 1, time: '19:00' }, { slot: 2, time: '19:30' }, { slot: 3, time: '20:00' }] }),
      expect.objectContaining({ label: 'Jueves', slots: [{ slot: 1, time: '18:00' }, { slot: 2, time: '18:30' }, { slot: 3, time: '19:00' }] }),
      expect.objectContaining({ label: 'Viernes', slots: [{ slot: 1, time: '17:30' }, { slot: 2, time: '18:00' }, { slot: 3, time: '18:30' }] }),
      expect.objectContaining({ label: 'Sábado', slots: [{ slot: 1, time: '18:30' }, { slot: 2, time: '19:00' }, { slot: 3, time: '19:30' }] }),
      expect.objectContaining({ label: 'Domingo', slots: [{ slot: 1, time: '19:00' }, { slot: 2, time: '19:30' }, { slot: 3, time: '20:00' }] }),
    ])
  })

  it('maps a local date to its weekday rule without depending on server timezone', () => {
    expect(instagramStoryRuleForDate('2026-08-24').label).toBe('Lunes')
    expect(instagramStoryRuleForDate('2026-08-30').label).toBe('Domingo')
  })
})
