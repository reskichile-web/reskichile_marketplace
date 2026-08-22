import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Vercel cron configuration', () => {
  it('preserves sale reminders and adds one daily Instagram run', () => {
    const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'))

    expect(config.crons).toContainEqual({
      path: '/api/cron/sale-reminders',
      schedule: '0 14 * * *',
    })
    expect(config.crons).toContainEqual({
      path: '/api/cron/instagram-publish',
      schedule: '0 23 * * *',
    })
  })
})
