import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Off-season Vercel cron configuration', () => {
  it('runs only the availability reminder checker', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
    expect(config.crons).toEqual([{ path: '/api/cron/sale-reminders', schedule: '0 14 * * *' }])
  })
})
