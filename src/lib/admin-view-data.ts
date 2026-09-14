import 'server-only'

import type { InstagramAdminCalendarResponse } from '@/lib/instagram/admin-contracts'
import type { InstagramStoryCaptureStatus } from '@/lib/instagram/contracts'
import { isInstagramCatalogEnabled } from '@/lib/instagram/catalog-config'
import {
  INSTAGRAM_STORY_CALENDAR_START_DATE,
} from '@/lib/instagram/schedule-rules'
import { getInstagramPublishingConfig } from '@/lib/instagram/publishing-config'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import {
  adminPageMeta,
  serializeAdminFacetValues,
  type AdminPageMeta,
} from '@/lib/admin-pagination'
import { AdminRequestError } from '@/lib/admin-security'
import {
  toAdminDatabaseProductSort,
  type AdminTimeSort,
  type AdminViewSort,
} from '@/lib/admin-product-sort'

export interface AdminDashboardPendingProduct {
  id: string
  product_type: string
  brand: string
  model: string | null
  price: number
  created_at: string
  users: { name: string | null; email: string } | null
  product_images: { url: string; order: number }[]
}

export interface AdminDashboardVisit {
  id: number
  path: string
  created_at: string
  country: string | null
  city: string | null
  visitor_id: string | null
  users: { name: string | null } | null
}

export interface AdminRecentMessage {
  id: string
  body: string
  created_at: string
  conversation_id: string
  read_at: string | null
  sender: { name: string | null } | null
  conversations: {
    id: string
    products: { brand: string | null; model: string | null } | null
  } | null
}

export interface AdminRecentWhatsappClick {
  id: number
  created_at: string
  users: { name: string | null; email: string | null } | null
  products: {
    id: string
    brand: string | null
    model: string | null
    slug: string | null
  } | null
}

export interface AdminDashboardData {
  stats: {
    total: number
    pending: number
    approved: number
    sold: number
    visitsToday: number
    uniquesToday: number
  }
  pending: AdminDashboardPendingProduct[]
  visits: AdminDashboardVisit[]
  recentMessages: AdminRecentMessage[]
  recentWhatsappClicks: AdminRecentWhatsappClick[]
}

export interface AdminViewerData {
  userId: string
  email: string
  userName: string | null
  avatarUrl: string | null
}

export interface AdminUserListItem {
  id: string
  email: string
  name: string | null
  phone: string | null
  instagram: string | null
  is_admin: boolean
  must_change_password: boolean
  keep: boolean | null
  created_at: string
  avatar_url: string | null
  product_count: number
  email_confirmed_at: string | null
  email_deliverable: boolean | null
  last_activity: string | null
}

export interface AdminUsersPageData extends AdminPageMeta {
  users: AdminUserListItem[]
  stats: {
    total: number
    active: number
    pendingAccess: number
    inactive: number
  }
  currentUserId: string | null
}

export interface AdminProductListItem {
  id: string
  slug: string | null
  product_type: string
  brand: string
  model: string | null
  price: number
  sale_price: number | null
  status: string
  created_at: string
  days_published: number
  sale_reminder_sent_at: string | null
  seller_id: string
  anon_contact: string | null
  users: {
    name: string | null
    email: string
    phone?: string | null
    hide_phone?: boolean
  } | null
  product_images: { url: string; order: number }[]
  details_loaded?: boolean
  condition?: string
  region?: string
  comuna?: string
  description?: string | null
  rejection_reason?: string | null
  attributes?: Record<string, unknown> | null
}

export interface AdminProductsPageData extends AdminPageMeta {
  products: AdminProductListItem[]
  viewCounts: Record<string, number>
  contactCounts?: Record<string, { whatsapp: number; chat: number }>
  facets: {
    statusCounts: Record<string, number>
    brands: string[]
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} returned an invalid payload`)
  }
  return value as Record<string, unknown>
}

function throwAdminReadError(error: { code?: string; message?: string }, label: string): never {
  if (
    error.code === '42501'
    || error.code === 'PGRST301'
    || error.code === 'PGRST302'
    || error.message?.toLowerCase().includes('administrator access required')
    || error.message?.toLowerCase().includes('permission denied')
  ) {
    throw new AdminRequestError('No autorizado', 403, 'FORBIDDEN')
  }
  throw new Error(`${label} failed`)
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const client = createServerSupabaseClient()
  const { data, error } = await client.rpc('admin_dashboard_snapshot')
  if (error) throwAdminReadError(error, 'admin dashboard snapshot')
  return asRecord(data, 'admin dashboard') as unknown as AdminDashboardData
}

export async function getAdminViewer(): Promise<AdminViewerData> {
  const client = createServerSupabaseClient()
  const { data, error } = await client.rpc('admin_viewer')
  if (error) throwAdminReadError(error, 'admin viewer')
  return asRecord(data, 'admin viewer') as unknown as AdminViewerData
}

export async function getAdminUsersPage(options: {
  offset?: number
  limit?: number
  status?: string
  search?: string
} = {}): Promise<AdminUsersPageData> {
  const offset = options.offset ?? 0
  const limit = options.limit ?? 30
  const client = createServerSupabaseClient()
  const { data, error } = await client.rpc('admin_users_page', {
    p_offset: offset,
    p_limit: limit,
    p_status: options.status || 'all',
    p_search: options.search || '',
  })
  if (error) throwAdminReadError(error, 'admin users page')
  const payload = asRecord(data, 'admin users')
  const users = (payload.users || []) as AdminUserListItem[]
  const totalCount = Number(payload.totalCount || 0)
  return {
    users,
    stats: payload.stats as AdminUsersPageData['stats'],
    currentUserId: typeof payload.currentUserId === 'string' ? payload.currentUserId : null,
    ...adminPageMeta(totalCount, offset, users.length),
  }
}

export async function getAdminProductsPage(options: {
  offset?: number
  limit?: number
  status?: string
  brands?: string[]
  productTypes?: string[]
  search?: string
  timeSort?: AdminTimeSort
  viewSort?: AdminViewSort
} = {}): Promise<AdminProductsPageData> {
  const offset = options.offset ?? 0
  const limit = options.limit ?? 30
  const client = createServerSupabaseClient()
  const { data, error } = await client.rpc('admin_products_page', {
    p_offset: offset,
    p_limit: limit,
    p_status: options.status || 'all',
    p_brand: serializeAdminFacetValues(options.brands || []),
    p_product_type: serializeAdminFacetValues(options.productTypes || []),
    p_search: options.search || '',
    p_time_sort: toAdminDatabaseProductSort(options.timeSort || '', options.viewSort || ''),
  })
  if (error) throwAdminReadError(error, 'admin products page')
  const payload = asRecord(data, 'admin products')
  const products = (payload.products || []) as AdminProductListItem[]
  const totalCount = Number(payload.totalCount || 0)
  const productIds = products.map(product => product.id)
  const contactCounts: AdminProductsPageData['contactCounts'] = {}
  if (productIds.length > 0) {
    const { data: contactRows, error: contactError } = await client
      .from('events')
      .select('product_id, event_name')
      .in('product_id', productIds)
      .eq('event_type', 'click')
      .in('event_name', ['whatsapp_contact', 'chat_contact'])

    if (contactError) throwAdminReadError(contactError, 'admin product contact counts')
    for (const row of contactRows || []) {
      if (!row.product_id) continue
      const counts = contactCounts[row.product_id] || { whatsapp: 0, chat: 0 }
      if (row.event_name === 'whatsapp_contact') counts.whatsapp += 1
      if (row.event_name === 'chat_contact') counts.chat += 1
      contactCounts[row.product_id] = counts
    }
  }
  return {
    products,
    viewCounts: (payload.viewCounts || {}) as Record<string, number>,
    contactCounts,
    facets: payload.facets as AdminProductsPageData['facets'],
    ...adminPageMeta(totalCount, offset, products.length),
  }
}

function chileToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function addLocalDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function localDateDistance(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T12:00:00Z`).getTime()
  const end = new Date(`${endDate}T12:00:00Z`).getTime()
  return Math.max(0, Math.floor((end - start) / 86_400_000))
}

interface StoryLibraryRow {
  id: string
  product_id: string
  status: string
  jpeg_public_url: string | null
  approved_at: string
  generated_at: string | null
  updated_at: string
  scheduled_local_date: string | null
  scheduled_slot: number | null
  scheduled_for: string | null
  schedule_source: 'automatic' | 'manual' | null
  container_id: string | null
  media_id: string | null
  published_at: string | null
  publication_count: number
  last_published_at: string | null
  attempts: number
  last_error: string | null
  products: {
    id: string
    brand: string
    model: string | null
    slug: string | null
    product_type: string
    price: number
    product_images: { url: string; order: number }[]
  } | null
}

function storyLibraryProduct(row: StoryLibraryRow): InstagramAdminCalendarResponse['products'][number] | null {
  const product = row.products
  if (!product) return null
  const imageUrl = [...(product.product_images || [])]
    .sort((left, right) => left.order - right.order)[0]?.url || null
  return {
    id: product.id,
    title: [product.brand, product.model].filter(Boolean).join(' '),
    slug: product.slug || product.id,
    productType: product.product_type,
    price: product.price,
    imageUrl,
    capture: {
      id: row.id,
      productId: row.product_id,
      status: row.status as InstagramStoryCaptureStatus,
      jpegPublicUrl: row.jpeg_public_url,
      approvedAt: row.approved_at,
      generatedAt: row.generated_at,
      updatedAt: row.updated_at,
      scheduledLocalDate: row.scheduled_local_date,
      scheduledSlot: row.scheduled_slot,
      scheduledFor: row.scheduled_for,
      scheduleSource: row.schedule_source,
      containerId: row.container_id,
      mediaId: row.media_id,
      publishedAt: row.published_at,
      publicationCount: row.publication_count,
      lastPublishedAt: row.last_published_at,
      attempts: row.attempts,
      lastError: row.last_error,
    },
  }
}

export async function getAdminInstagramStories(options: {
  historyDays?: number
  includeUncaptured?: boolean
} = {}): Promise<InstagramAdminCalendarResponse> {
  const today = chileToday()
  const availableHistoryDays = localDateDistance(INSTAGRAM_STORY_CALENDAR_START_DATE, today)
  const requestedHistoryDays = Number(options.historyDays || 0)
  const historyDays = Number.isInteger(requestedHistoryDays)
    ? Math.min(availableHistoryDays, Math.max(0, requestedHistoryDays))
    : 0
  const historyStart = addLocalDays(today, -historyDays)
  const client = createServerSupabaseClient()
  const { data, error } = await client.rpc('admin_instagram_stories', {
    p_history_start: historyStart,
    p_include_uncaptured: Boolean(options.includeUncaptured),
  })
  if (error) throwAdminReadError(error, 'admin instagram stories')
  const payload = asRecord(data, 'admin instagram stories')
  const service = createServiceRoleClient()
  const futureEnd = addLocalDays(today, 35)
  // The RPC keeps already-published products out of the pending generation
  // queue. Merge their reusable JPEG captures back into the admin library so
  // an editor can deliberately schedule them again without automatic slots.
  const [catalog, occupied, storyLibrary] = await Promise.all([
    client.rpc('admin_instagram_catalog_batches', { p_history_start: historyStart }),
    service
      .from('instagram_story_captures')
      .select('scheduled_local_date, scheduled_slot')
      .gte('scheduled_local_date', historyStart)
      .lte('scheduled_local_date', futureEnd),
    service
      .from('instagram_story_captures')
      .select('id, product_id, status, jpeg_public_url, approved_at, generated_at, updated_at, scheduled_local_date, scheduled_slot, scheduled_for, schedule_source, container_id, media_id, published_at, publication_count, last_published_at, attempts, last_error, products!inner(id, brand, model, slug, product_type, price, status, product_images(url, order))')
      .eq('products.status', 'approved')
      .not('jpeg_public_url', 'is', null)
      .not('generated_at', 'is', null),
  ])
  // Allow an explicitly visible pre-migration state during a coordinated rollout.
  const missingCatalog = catalog.error && ['PGRST202', '42883'].includes(catalog.error.code)
  if (catalog.error && !missingCatalog) throwAdminReadError(catalog.error, 'admin instagram catalog')
  if (occupied.error) throwAdminReadError(occupied.error, 'admin instagram occupied slots')
  if (storyLibrary.error) throwAdminReadError(storyLibrary.error, 'admin instagram story library')
  const productsById = new Map(
    ((payload.products || []) as InstagramAdminCalendarResponse['products'])
      .map((product) => [product.id, product]),
  )
  for (const row of storyLibrary.data || []) {
    const product = storyLibraryProduct(row as unknown as StoryLibraryRow)
    if (product) productsById.set(product.id, product)
  }
  return {
    ok: true,
    publishingEnabled: getInstagramPublishingConfig().enabled,
    products: [...productsById.values()],
    publications: (payload.publications || []) as InstagramAdminCalendarResponse['publications'],
    occupiedSlots: (occupied.data || []).flatMap((row) => (
      row.scheduled_local_date && row.scheduled_slot
        ? [{ localDate: row.scheduled_local_date, slot: row.scheduled_slot }]
        : []
    )),
    catalogBatches: catalog.error ? [] : (catalog.data || []) as NonNullable<InstagramAdminCalendarResponse['catalogBatches']>,
    catalogAvailable: !catalog.error,
    catalogEnabled: isInstagramCatalogEnabled() && getInstagramPublishingConfig().enabled,
  }
}
