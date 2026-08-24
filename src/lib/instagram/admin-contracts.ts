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

export interface InstagramAdminPublication {
  id: string
  captureId: string
  productId: string
  title: string
  slug: string
  productType: string
  imageUrl: string | null
  containerId: string
  mediaId: string | null
  publishedAt: string
  recovered: boolean
  scheduledLocalDate: string
  scheduledSlot: number
  scheduledFor: string
  scheduleSource: 'automatic' | 'manual' | null
}

export interface InstagramAdminCalendarResponse {
  ok: true
  publishingEnabled: boolean
  products: InstagramAdminProduct[]
  publications: InstagramAdminPublication[]
}
