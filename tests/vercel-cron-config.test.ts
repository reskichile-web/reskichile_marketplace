import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Vercel cron configuration', () => {
  it('keeps Instagram publishing active in the configured 15-minute slots', () => {
    const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'))
    const expectedTimes = [
      '2030', '2045', '2100', '2115', '2130', '2145', '2200', '2215', '2230',
      '2245', '2300', '2315', '2330', '2345', '0000', '0015', '0030',
    ]

    expect(config.crons ?? []).toEqual(expectedTimes.map(time => ({
      path: `/api/cron/instagram-publish/t${time}`,
      schedule: `${Number(time.slice(2))} ${Number(time.slice(0, 2))} * * *`,
    })))
  })
})
