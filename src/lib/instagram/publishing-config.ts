import 'server-only'

export const INSTAGRAM_GRAPH_API_VERSION = 'v26.0'
export const INSTAGRAM_PUBLISHING_QUOTA = 100
export const INSTAGRAM_PUBLISHING_MAX_ATTEMPTS = 3

export interface InstagramPublishingConfig {
  enabled: boolean
  accessToken: string | null
  userId: string | null
  apiVersion: typeof INSTAGRAM_GRAPH_API_VERSION
  publishingQuota: typeof INSTAGRAM_PUBLISHING_QUOTA
  maxAttempts: typeof INSTAGRAM_PUBLISHING_MAX_ATTEMPTS
}

export class InstagramConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InstagramConfigurationError'
  }
}

export function getInstagramCronSecret(): string {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || secret.length < 32) {
    throw new InstagramConfigurationError('CRON_SECRET no está configurado de forma segura')
  }
  return secret
}

export function getInstagramPublishingConfig(): InstagramPublishingConfig {
  const enabled = process.env.INSTAGRAM_PUBLISHING_ENABLED === 'true'
  const accessToken = process.env.META_INSTAGRAM_ACCESS_TOKEN?.trim() || null
  const userId = process.env.META_INSTAGRAM_USER_ID?.trim() || null

  if (enabled && !accessToken) {
    throw new InstagramConfigurationError('META_INSTAGRAM_ACCESS_TOKEN no está configurado')
  }
  if (enabled && (!userId || !/^\d{8,30}$/.test(userId))) {
    throw new InstagramConfigurationError('META_INSTAGRAM_USER_ID no está configurado')
  }

  return {
    enabled,
    accessToken,
    userId,
    apiVersion: INSTAGRAM_GRAPH_API_VERSION,
    publishingQuota: INSTAGRAM_PUBLISHING_QUOTA,
    maxAttempts: INSTAGRAM_PUBLISHING_MAX_ATTEMPTS,
  }
}
