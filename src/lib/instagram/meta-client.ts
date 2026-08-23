import 'server-only'

import type { InstagramPublishingConfig } from './publishing-config'

const META_REQUEST_TIMEOUT_MS = 20_000

export type MetaContainerStatusCode =
  | 'EXPIRED'
  | 'ERROR'
  | 'FINISHED'
  | 'IN_PROGRESS'
  | 'PUBLISHED'

interface MetaErrorBody {
  error?: {
    message?: string
    type?: string
    code?: number
    error_subcode?: number
    is_transient?: boolean
  }
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly code: number | null,
    public readonly retryable: boolean,
    public readonly uncertain: boolean,
  ) {
    super(message)
    this.name = 'MetaApiError'
  }
}

export interface MetaContainerStatus {
  statusCode: MetaContainerStatusCode
  status: string | null
}

export interface InstagramMetaClient {
  getPublishingLimit(): Promise<number>
  createStoryContainer(imageUrl: string): Promise<string>
  getContainerStatus(containerId: string): Promise<MetaContainerStatus>
  publishContainer(containerId: string): Promise<string>
}

function sanitizeMetaMessage(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return 'Meta rechazó la solicitud'
  return value
    .replace(/authorization\s*:\s*bearer\s+[^\s,;]+/gi, 'Authorization: Bearer [redacted]')
    .replace(/((?:access_token|token)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/https?:\/\/[^\s]+/gi, '[url]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 350)
}

function retryableStatus(status: number, body: MetaErrorBody): boolean {
  return status === 408 || status === 429 || status >= 500 || body.error?.is_transient === true
}

export function createInstagramMetaClient(
  config: InstagramPublishingConfig,
  fetchImpl: typeof fetch = fetch,
): InstagramMetaClient {
  if (!config.accessToken || !config.userId) {
    throw new Error('La publicación de Instagram no está configurada')
  }

  const baseUrl = `https://graph.instagram.com/${config.apiVersion}`
  const authorization = `Bearer ${config.accessToken}`

  async function request<T>(
    path: string,
    init: { method?: 'GET' | 'POST'; body?: URLSearchParams } = {},
  ): Promise<T> {
    const method = init.method || 'GET'
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: authorization,
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        },
        body: init.body?.toString(),
        cache: 'no-store',
        signal: AbortSignal.timeout(META_REQUEST_TIMEOUT_MS),
      })
      const body = await response.json().catch(() => ({})) as T & MetaErrorBody
      if (!response.ok) {
        throw new MetaApiError(
          sanitizeMetaMessage(body.error?.message),
          response.status,
          typeof body.error?.code === 'number' ? body.error.code : null,
          retryableStatus(response.status, body),
          false,
        )
      }
      return body
    } catch (error) {
      if (error instanceof MetaApiError) throw error
      throw new MetaApiError(
        method === 'POST' ? 'Meta no confirmó la operación' : 'No pudimos consultar Meta',
        null,
        null,
        true,
        method === 'POST',
      )
    }
  }

  return {
    async getPublishingLimit() {
      const body = await request<{
        quota_usage?: number
        data?: Array<{ quota_usage?: number }>
      }>(
        `/${encodeURIComponent(config.userId!)}/content_publishing_limit?fields=quota_usage`,
      )
      const usage = Number(body.data?.[0]?.quota_usage ?? body.quota_usage)
      if (!Number.isFinite(usage) || usage < 0) {
        throw new MetaApiError('Meta devolvió una cuota inválida', null, null, true, false)
      }
      return Math.floor(usage)
    },

    async createStoryContainer(imageUrl: string) {
      const body = await request<{ id?: string }>(
        `/${encodeURIComponent(config.userId!)}/media`,
        {
          method: 'POST',
          body: new URLSearchParams({ image_url: imageUrl, media_type: 'STORIES' }),
        },
      )
      if (!body.id) throw new MetaApiError('Meta no devolvió el container ID', null, null, true, true)
      return body.id
    },

    async getContainerStatus(containerId: string) {
      const body = await request<{ status_code?: string; status?: string }>(
        `/${encodeURIComponent(containerId)}?fields=status_code,status`,
      )
      const known = new Set<MetaContainerStatusCode>([
        'EXPIRED',
        'ERROR',
        'FINISHED',
        'IN_PROGRESS',
        'PUBLISHED',
      ])
      if (!body.status_code || !known.has(body.status_code as MetaContainerStatusCode)) {
        throw new MetaApiError('Meta devolvió un estado de container desconocido', null, null, true, false)
      }
      return {
        statusCode: body.status_code as MetaContainerStatusCode,
        status: typeof body.status === 'string' ? sanitizeMetaMessage(body.status) : null,
      }
    },

    async publishContainer(containerId: string) {
      const body = await request<{ id?: string }>(
        `/${encodeURIComponent(config.userId!)}/media_publish`,
        {
          method: 'POST',
          body: new URLSearchParams({ creation_id: containerId }),
        },
      )
      if (!body.id) throw new MetaApiError('Meta no devolvió el media ID', null, null, true, true)
      return body.id
    },
  }
}
