import { describe, expect, it } from 'vitest'
import {
  INSTAGRAM_STORY_FORMAT,
  INSTAGRAM_STORY_HEIGHT,
  INSTAGRAM_STORY_WIDTH,
  storyStoragePath,
  versionedStoryStoragePath,
} from '@/lib/instagram/contracts'
import { sanitizeCaptureError } from '@/lib/instagram/capture'

describe('Instagram Story capture contract', () => {
  it('uses one deterministic JPEG path per product', () => {
    const productId = '92000000-0000-4000-8000-000000000001'
    expect(storyStoragePath(productId)).toBe(
      `_instagram/products/${productId}/story.jpg`,
    )
    expect(storyStoragePath(productId)).toBe(storyStoragePath(productId))
  })

  it('uses a unique immutable path for regenerated Stories', () => {
    const productId = '92000000-0000-4000-8000-000000000001'
    expect(versionedStoryStoragePath(productId, 'm1-test')).toBe(
      `_instagram/products/${productId}/story-m1-test.jpg`,
    )
  })

  it('fixes the renderer output at 1080×1920 JPEG', () => {
    expect({
      width: INSTAGRAM_STORY_WIDTH,
      height: INSTAGRAM_STORY_HEIGHT,
      format: INSTAGRAM_STORY_FORMAT,
    }).toEqual({ width: 1080, height: 1920, format: 'jpeg' })
  })

  it('does not expose Chromium server paths in admin errors', () => {
    const error = new Error(
      'The input directory "/var/task/node_modules/@sparticuz/chromium/bin" does not exist. Please provide the location of the brotli files.',
    )

    expect(sanitizeCaptureError(error)).toBe(
      'No pudimos iniciar el motor de render de la Story',
    )
  })
})
