import type { InstagramStoryCaptureStatus } from './contracts'

export interface InstagramAdminCapture {
  id: string
  productId: string
  status: InstagramStoryCaptureStatus
  jpegPublicUrl: string | null
  approvedAt: string
  generatedAt: string | null
  updatedAt: string
  scheduledLocalDate: string | null
  scheduledSlot: number | null
  scheduledFor: string | null
  scheduleSource: 'automatic' | 'manual' | null
  containerId: string | null
  mediaId: string | null
  publishedAt: string | null
  publicationCount: number
  lastPublishedAt: string | null
  attempts: number
  lastError: string | null
}

export interface InstagramAdminProduct {
  id: string
  title: string
  slug: string
  productType: string
  price: number
  imageUrl: string | null
  capture: InstagramAdminCapture | null
}

export interface InstagramAdminCalendarResponse {
  ok: true
  publishingEnabled: boolean
  products: InstagramAdminProduct[]
}
