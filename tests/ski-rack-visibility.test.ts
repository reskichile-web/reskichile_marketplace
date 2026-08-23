import { describe, expect, it } from 'vitest'
import { isSkiRackStorefrontEnabled } from '@/lib/ski-rack-visibility'

describe('ski rack storefront visibility', () => {
  it('is hidden on Vercel Production', () => {
    expect(isSkiRackStorefrontEnabled('production', 'production')).toBe(false)
  })

  it('remains visible on Vercel Preview for the Webpay sandbox', () => {
    expect(isSkiRackStorefrontEnabled('preview', 'production')).toBe(true)
  })

  it('remains visible during local development', () => {
    expect(isSkiRackStorefrontEnabled(undefined, 'development')).toBe(true)
  })

  it('fails closed in a non-Vercel production runtime', () => {
    expect(isSkiRackStorefrontEnabled(undefined, 'production')).toBe(false)
  })
})
