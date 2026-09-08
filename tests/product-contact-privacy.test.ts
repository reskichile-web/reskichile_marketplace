import { describe, expect, it } from 'vitest'
import {
  PRODUCT_WITH_EDIT_IMAGES_SELECT,
  PRODUCT_WITH_IMAGES_SELECT,
} from '@/lib/product-select'

describe('anonymous seller contact privacy', () => {
  it('keeps anon_contact out of browser product projections', () => {
    expect(PRODUCT_WITH_IMAGES_SELECT).not.toContain('anon_contact')
    expect(PRODUCT_WITH_EDIT_IMAGES_SELECT).not.toContain('anon_contact')
  })
})
