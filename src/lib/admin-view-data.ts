import 'server-only'

import type { InstagramAdminCalendarResponse } from '@/lib/instagram/admin-contracts'
import {
  INSTAGRAM_STORY_CALENDAR_START_DATE,
} from '@/lib/instagram/schedule-rules'
import { getInstagramPublishingConfig } from '@/lib/instagram/publishing-config'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { adminPageMeta, type AdminPageMeta } from '@/lib/admin-pagination'
import { AdminRequestError } from '@/lib/admin-security'

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
  brand?: string
  productType?: string
  search?: string
} = {}): Promise<AdminProductsPageData> {
  const offset = options.offset ?? 0
  const limit = options.limit ?? 30
  const client = createServerSupabaseClient()
  const { data, error } = await client.rpc('admin_products_page', {
    p_offset: offset,
    p_limit: limit,
    p_status: options.status || 'all',
    p_brand: options.brand || '',
    p_product_type: options.productType || '',
    p_search: options.search || '',
  })
  if (error) throwAdminReadError(error, 'admin products page')
  const payload = asRecord(data, 'admin products')
  const products = (payload.products || []) as AdminProductListItem[]
  const totalCount = Number(payload.totalCount || 0)
  return {
    products,
    viewCounts: (payload.viewCounts || {}) as Record<string, number>,
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
  return {
    ok: true,
    publishingEnabled: getInstagramPublishingConfig().enabled,
    products: (payload.products || []) as InstagramAdminCalendarResponse['products'],
    publications: (payload.publications || []) as InstagramAdminCalendarResponse['publications'],
  }
}
