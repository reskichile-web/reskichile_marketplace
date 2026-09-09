export type CatalogBatchStatus = 'pending' | 'generating' | 'ready' | 'publishing' | 'retry' | 'failed' | 'published' | 'skipped'

export interface CatalogProduct {
  id: string
  slug: string
  status: string
  created_at: string
  product_type: string
  brand: string | null
  model: string | null
  price: number
  condition: string
  region: string | null
  comuna: string | null
  attributes: Record<string, unknown> | null
  product_images: { url: string; order: number }[]
}

export interface CatalogSlide {
  position: number
  kind: 'intro' | 'products'
  products: CatalogProduct[]
  imageUrl: string
  containerId: string | null
  mediaId: string | null
  attemptedAt: string | null
  publishedAt: string | null
}

export interface CatalogBatch {
  local_date: string
  scheduled_for: string
  prepare_at: string
  status: CatalogBatchStatus
  generated_at: string | null
  generation_attempts: number
  slides: CatalogSlide[]
  last_error: string | null
  lock_token: string
}

export interface InstagramAdminCatalogBatch {
  localDate: string
  scheduledFor: string
  prepareAt: string
  status: CatalogBatchStatus
  generatedAt: string | null
  lastError: string | null
  generationAttempts: number
  slides: { position: number; kind: 'intro' | 'products'; imageUrl: string; publishedAt: string | null }[]
}
