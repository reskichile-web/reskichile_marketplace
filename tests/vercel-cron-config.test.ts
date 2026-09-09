import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Vercel cron configuration', () => {
  it('keeps Instagram publishing active in the configured 15-minute slots', () => {
    const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'))
    const expectedTimes = [
      '1430', '1445', '1500', '1515', '1530', '1545', '1600', '1615', '1630',
      '1645', '1700', '1715',
      '2030', '2045', '2100', '2115', '2130', '2145', '2200', '2215', '2230',
      '2245', '2300', '2315', '2330', '2345', '0000', '0015', '0030', '0045',
    ]

    expect((config.crons ?? []).filter((cron: { path: string }) => cron.path.startsWith('/api/cron/instagram-publish/'))).toEqual(expectedTimes.map(time => ({
      path: `/api/cron/instagram-publish/t${time}`,
      schedule: `${Number(time.slice(2))} ${Number(time.slice(0, 2))} * * *`,
    })))
  })
})
