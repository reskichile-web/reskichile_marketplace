import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Vercel cron configuration', () => {
  it('pauses Vercel cron invocations during the Supabase incident', () => {
    const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'))

    expect(config.crons ?? []).toEqual([])
  })
})
