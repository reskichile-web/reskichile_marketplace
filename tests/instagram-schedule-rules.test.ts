import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { INSTAGRAM_STORY_DAY_RULES, INSTAGRAM_STORY_SLOTS_PER_DAY,
  isInstagramStorySlotForDate, instagramStoryRuleForDate } from '@/lib/instagram/schedule-rules'

describe('Instagram Story schedule rules', () => {
  it('preserves five historical slots with original times', () => {
    expect(instagramStoryRuleForDate('2026-09-09').slots.map(s => s.time))
      .toEqual(['19:00', '19:15', '19:30', '19:45', '20:00'])
  })
  it('caps every day at three editorial blocks', () => {
    expect(INSTAGRAM_STORY_SLOTS_PER_DAY).toBe(3)
    expect(INSTAGRAM_STORY_DAY_RULES).toHaveLength(7)
    for (const rule of INSTAGRAM_STORY_DAY_RULES) expect(rule.slots).toHaveLength(3)
  })
  it('reserves Tuesday and Friday 20:00 for catalog only', () => {
    for (const [date, time] of [['2026-09-15', '20:00'], ['2026-09-11', '20:00']]) {
      expect(instagramStoryRuleForDate(date).slots).toEqual([
        { slot: 1, time: '11:30' }, { slot: 2, time: '12:30' }, { slot: 3, time, kind: 'catalog' },
      ])
      expect(isInstagramStorySlotForDate(date, 2)).toBe(true)
      expect(isInstagramStorySlotForDate(date, 3)).toBe(false)
    }
  })
  it('keeps three individual slots on other days and rejects overflow', () => {
    for (const date of ['2026-09-14', '2026-09-16', '2026-09-10', '2026-09-12', '2026-09-13']) {
      expect(isInstagramStorySlotForDate(date, 3)).toBe(true)
      expect(isInstagramStorySlotForDate(date, 4)).toBe(false)
      expect(isInstagramStorySlotForDate(date, 5)).toBe(false)
    }
    expect(isInstagramStorySlotForDate('invalid-date', 1)).toBe(false)
    expect(isInstagramStorySlotForDate('2026-09-14', 1.5)).toBe(false)
  })
  it('matches assignable PostgreSQL rules exactly', () => {
    const transition = readFileSync('supabase/migrations/202609100001_instagram_catalog_tuesday_friday.sql', 'utf8')
    for (const rule of INSTAGRAM_STORY_DAY_RULES.filter(rule => [2, 3, 5, 7].includes(rule.isoWeekday))) {
      for (const slot of rule.slots.filter(slot => slot.kind !== 'catalog')) {
        expect(transition).toContain(`(${rule.isoWeekday}, ${slot.slot}, '${slot.time}')`)
      }
    }
    expect(transition).toContain("UPDATE public.instagram_catalog_schedule_rules SET local_time = '20:00'")
  })
  it('has cron ticks for all slots and retries in summer and winter', () => {
    const { crons } = JSON.parse(readFileSync('vercel.json', 'utf8')) as { crons: { path: string, schedule: string }[] }
    expect(new Set(crons.map(c => c.path)).size).toBe(crons.length)
    const ticks = new Set(crons.map(c => c.schedule))
    for (const rule of INSTAGRAM_STORY_DAY_RULES) for (const slot of rule.slots) {
      const [hour, minute] = slot.time.split(':').map(Number)
      for (const offset of [3, 4]) for (const retry of [0, 15, 30, 45]) {
        const total = (hour + offset) * 60 + minute + retry
        expect(ticks.has(`${total % 60} ${Math.floor(total / 60) % 24} * * *`)).toBe(true)
      }
    }
  })
})
