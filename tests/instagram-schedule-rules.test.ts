import { describe, expect, it } from 'vitest'
import {
  INSTAGRAM_STORY_DAY_RULES,
  INSTAGRAM_STORY_SLOTS_PER_DAY,
  isInstagramStorySlotForDate,
  instagramStoryRuleForDate,
} from '@/lib/instagram/schedule-rules'

describe('Instagram Story schedule rules', () => {
  it('uses five quarter-hour slots and leaves the final Hobby delay inside each window', () => {
    expect(INSTAGRAM_STORY_SLOTS_PER_DAY).toBe(5)
    expect(INSTAGRAM_STORY_DAY_RULES).toEqual([
      expect.objectContaining({ label: 'Lunes', slots: [{ slot: 1, time: '19:30' }, { slot: 2, time: '19:45' }, { slot: 3, time: '20:00' }, { slot: 4, time: '20:15' }, { slot: 5, time: '20:30' }] }),
      expect.objectContaining({ label: 'Martes', slots: [{ slot: 1, time: '19:30' }, { slot: 2, time: '19:45' }, { slot: 3, time: '20:00' }, { slot: 4, time: '20:15' }, { slot: 5, time: '20:30' }] }),
      expect.objectContaining({ label: 'Miércoles', slots: [{ slot: 1, time: '19:00' }, { slot: 2, time: '19:15' }, { slot: 3, time: '19:30' }, { slot: 4, time: '19:45' }, { slot: 5, time: '20:00' }] }),
      expect.objectContaining({ label: 'Jueves', slots: [{ slot: 1, time: '18:00' }, { slot: 2, time: '18:15' }, { slot: 3, time: '18:30' }, { slot: 4, time: '18:45' }, { slot: 5, time: '19:00' }] }),
      expect.objectContaining({ label: 'Viernes', slots: [{ slot: 1, time: '17:30' }, { slot: 2, time: '17:45' }, { slot: 3, time: '18:00' }, { slot: 4, time: '18:15' }, { slot: 5, time: '18:30' }] }),
      expect.objectContaining({ label: 'Sábado', slots: [{ slot: 1, time: '18:30' }, { slot: 2, time: '18:45' }, { slot: 3, time: '19:00' }, { slot: 4, time: '19:15' }, { slot: 5, time: '19:30' }] }),
      expect.objectContaining({ label: 'Domingo', slots: [{ slot: 1, time: '19:00' }, { slot: 2, time: '19:15' }, { slot: 3, time: '19:30' }, { slot: 4, time: '19:45' }, { slot: 5, time: '20:00' }] }),
    ])
  })

  it('maps a local date to its weekday rule without depending on server timezone', () => {
    expect(instagramStoryRuleForDate('2026-08-24').label).toBe('Lunes')
    expect(instagramStoryRuleForDate('2026-08-30').label).toBe('Domingo')
  })

  it('validates slots from the configured weekday instead of a fixed TypeScript union', () => {
    expect(isInstagramStorySlotForDate('2026-08-24', 5)).toBe(true)
    expect(isInstagramStorySlotForDate('2026-08-24', 6)).toBe(false)
    expect(isInstagramStorySlotForDate('invalid-date', 1)).toBe(false)
  })
})
