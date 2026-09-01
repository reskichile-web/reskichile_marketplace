import { describe, expect, it } from 'vitest'
import { isSkiRackStorefrontEnabled } from '@/lib/ski-rack-visibility'

describe('ski rack storefront visibility', () => {
  it('is visible by default, including in production', () => {
    expect(isSkiRackStorefrontEnabled(undefined)).toBe(true)
  })

  it('can be explicitly published', () => {
    expect(isSkiRackStorefrontEnabled('true')).toBe(true)
    expect(isSkiRackStorefrontEnabled(' TRUE ')).toBe(true)
  })

  it('can be hidden with the emergency visibility switch', () => {
    expect(isSkiRackStorefrontEnabled('false')).toBe(false)
  })

  it('fails closed for an invalid explicit setting', () => {
    expect(isSkiRackStorefrontEnabled('enabled')).toBe(false)
  })
})
