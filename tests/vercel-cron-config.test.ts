import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Vercel cron configuration', () => {
  it('preserves sale reminders and adds the nine daily Hobby-safe Instagram ticks', () => {
    const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'))

    expect(config.crons).toContainEqual({
      path: '/api/cron/sale-reminders',
      schedule: '0 14 * * *',
    })
    expect(config.crons.filter((entry: { path: string }) => entry.path.startsWith('/api/cron/instagram-publish/')))
      .toEqual([
        { path: '/api/cron/instagram-publish/t2030', schedule: '30 20 * * *' },
        { path: '/api/cron/instagram-publish/t2100', schedule: '0 21 * * *' },
        { path: '/api/cron/instagram-publish/t2130', schedule: '30 21 * * *' },
        { path: '/api/cron/instagram-publish/t2200', schedule: '0 22 * * *' },
        { path: '/api/cron/instagram-publish/t2230', schedule: '30 22 * * *' },
        { path: '/api/cron/instagram-publish/t2300', schedule: '0 23 * * *' },
        { path: '/api/cron/instagram-publish/t2330', schedule: '30 23 * * *' },
        { path: '/api/cron/instagram-publish/t0000', schedule: '0 0 * * *' },
        { path: '/api/cron/instagram-publish/t0030', schedule: '30 0 * * *' },
      ])
  })
})
