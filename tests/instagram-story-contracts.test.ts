import { describe, expect, it } from 'vitest'
import {
  INSTAGRAM_STORY_FORMAT,
  INSTAGRAM_STORY_HEIGHT,
  INSTAGRAM_STORY_WIDTH,
  storyStoragePath,
} from '@/lib/instagram/contracts'

describe('Instagram Story capture contract', () => {
  it('uses one deterministic JPEG path per product', () => {
    const productId = '92000000-0000-4000-8000-000000000001'
    expect(storyStoragePath(productId)).toBe(
      `_instagram/products/${productId}/story.jpg`,
    )
    expect(storyStoragePath(productId)).toBe(storyStoragePath(productId))
  })

  it('fixes the renderer output at 1080×1920 JPEG', () => {
    expect({
      width: INSTAGRAM_STORY_WIDTH,
      height: INSTAGRAM_STORY_HEIGHT,
      format: INSTAGRAM_STORY_FORMAT,
    }).toEqual({ width: 1080, height: 1920, format: 'jpeg' })
  })
})
