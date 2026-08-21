import { describe, expect, it } from 'vitest'
import { buildReviewEmail } from '@/lib/email/templates'

describe('email template links', () => {
  it('always sends marketplace review links to the public site', () => {
    const email = buildReviewEmail('Matías', 'Rossignol', 'Hero Athlete FIS GS')

    expect(email.html).toContain('https://www.reskichile.cl/mis-productos')
    expect(email.text).toContain('https://www.reskichile.cl/mis-productos')
    expect(email.html).not.toContain('.vercel.app')
    expect(email.text).not.toContain('.vercel.app')
  })
})
