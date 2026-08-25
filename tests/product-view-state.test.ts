import { describe, expect, it } from 'vitest'
import { isProductOwner, showClaimListingsPrompt, showPublicProductActions } from '@/lib/product-view-state'

describe('product viewer state', () => {
  it('never treats an anonymous viewer as owner of a sellerless product', () => {
    expect(isProductOwner(null, null)).toBe(false)
    expect(isProductOwner(null, 'seller-1')).toBe(false)
    expect(isProductOwner('owner-1', null)).toBe(false)
    expect(isProductOwner('owner-1', 'owner-1')).toBe(true)
  })

  it('does not flash anonymous actions while session state is loading', () => {
    expect(showPublicProductActions({ loading: true, canEdit: false })).toBe(false)
  })

  it('shows contact actions to a resolved public viewer', () => {
    expect(showPublicProductActions({ loading: false, canEdit: false })).toBe(true)
  })

  it('never mixes owner or admin controls with public actions', () => {
    expect(showPublicProductActions({ loading: false, canEdit: true })).toBe(false)
    expect(showClaimListingsPrompt({ loading: false, canEdit: true, isCommerceProduct: false })).toBe(false)
  })

  it('shows the reclaim prompt only in the resolved public marketplace view', () => {
    expect(showClaimListingsPrompt({ loading: false, canEdit: false, isCommerceProduct: false })).toBe(true)
    expect(showClaimListingsPrompt({ loading: false, canEdit: false, isCommerceProduct: true })).toBe(false)
  })
})
