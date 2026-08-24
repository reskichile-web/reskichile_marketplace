export const INSTAGRAM_STORY_WIDTH = 1080
export const INSTAGRAM_STORY_HEIGHT = 1920
export const INSTAGRAM_STORY_FORMAT = 'jpeg' as const

export type InstagramStoryCaptureStatus =
  | 'generating'
  | 'ready'
  | 'publishing'
  | 'published'
  | 'retry'
  | 'failed'

export interface InstagramStoryProductSummary {
  id: string
  title: string
  slug: string
}

export interface InstagramStoryCaptureResult {
  id: string
  status: InstagramStoryCaptureStatus
  jpegPublicUrl: string | null
  updatedAt: string
  width: typeof INSTAGRAM_STORY_WIDTH
  height: typeof INSTAGRAM_STORY_HEIGHT
  format: typeof INSTAGRAM_STORY_FORMAT
  error?: string
}

export interface InstagramStoryScheduleResult {
  scheduledLocalDate: string
  scheduledSlot: number
  scheduledFor: string
  scheduleSource: 'automatic' | 'manual'
}

export interface AdminApprovalResponse {
  ok: true
  approved: true
  transitioned: boolean
  emailed: boolean
  product: InstagramStoryProductSummary
  story: InstagramStoryCaptureResult
  schedule: InstagramStoryScheduleResult | null
}

export interface AdminStoryRetryResponse {
  ok: true
  approved: true
  product: InstagramStoryProductSummary
  story: InstagramStoryCaptureResult
  schedule: InstagramStoryScheduleResult | null
}

export function storyStoragePath(productId: string): string {
  return `_instagram/products/${productId}/story.jpg`
}

export function versionedStoryStoragePath(productId: string, version: string): string {
  const safeVersion = version.trim().replace(/[^a-zA-Z0-9_-]+/g, '-')
  if (!safeVersion) throw new Error('La versión de la Story es inválida')
  return `_instagram/products/${productId}/story-${safeVersion}.jpg`
}
