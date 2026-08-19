import { describe, expect, it } from 'vitest'
import { shouldShowSkiRackCart } from '@/lib/ski-rack-cart'

describe('Ski Rack cart visibility', () => {
  it('keeps the cart visible on Rack routes even when it is empty', () => {
    expect(shouldShowSkiRackCart({ itemCount: 0, ready: false, showWhenEmpty: true })).toBe(true)
  })

  it('shows a persisted cart on the rest of the marketplace', () => {
    expect(shouldShowSkiRackCart({ itemCount: 2, ready: true, showWhenEmpty: false })).toBe(true)
  })

  it('hides an empty cart outside Rack routes', () => {
    expect(shouldShowSkiRackCart({ itemCount: 0, ready: true, showWhenEmpty: false })).toBe(false)
  })
})
