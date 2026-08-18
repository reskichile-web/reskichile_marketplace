import 'server-only'

import { createHmac } from 'crypto'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getAppUrl, type RefundConfig } from '@/lib/env/server'

export class AdminRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message)
    this.name = 'AdminRequestError'
  }
}

export interface AdminRequestUser {
  id: string
  email: string
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin')
  let normalized = ''
  try {
    normalized = origin ? new URL(origin).origin : ''
  } catch {
    normalized = ''
  }
  if (!normalized || normalized !== getAppUrl().origin) {
    throw new AdminRequestError('Origen no permitido', 403, 'INVALID_ORIGIN')
  }
}

export async function readSmallJson(
  request: Request,
  maximumBytes = 4096
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim()
  if (contentType !== 'application/json') {
    throw new AdminRequestError('Content-Type inválido', 415, 'INVALID_CONTENT_TYPE')
  }

  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (declaredLength > maximumBytes) {
    throw new AdminRequestError('Solicitud demasiado grande', 413, 'BODY_TOO_LARGE')
  }

  const text = await request.text()
  if (Buffer.byteLength(text, 'utf8') > maximumBytes) {
    throw new AdminRequestError('Solicitud demasiado grande', 413, 'BODY_TOO_LARGE')
  }

  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new AdminRequestError('JSON inválido', 400, 'INVALID_JSON')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AdminRequestError('Solicitud inválida', 422, 'INVALID_BODY')
  }
  return value as Record<string, unknown>
}

export async function requireAdmin(): Promise<AdminRequestUser> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    throw new AdminRequestError('No autenticado', 401, 'UNAUTHENTICATED')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile?.is_admin) {
    throw new AdminRequestError('No autorizado', 403, 'FORBIDDEN')
  }

  return { id: user.id, email: user.email }
}

export async function requireElevatedAdmin(
  config: RefundConfig
): Promise<AdminRequestUser> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    throw new AdminRequestError('No autenticado', 401, 'UNAUTHENTICATED')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile?.is_admin) {
    throw new AdminRequestError('No autorizado', 403, 'FORBIDDEN')
  }

  const lastSignIn = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0
  const maximumAgeMs = config.recentSessionMinutes * 60 * 1000
  if (!lastSignIn || Date.now() - lastSignIn > maximumAgeMs) {
    throw new AdminRequestError(
      'Vuelve a iniciar sesión antes de reembolsar',
      403,
      'RECENT_LOGIN_REQUIRED'
    )
  }

  if (config.requireAal2) {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || data.currentLevel !== 'aal2') {
      throw new AdminRequestError(
        'Se requiere verificación MFA para reembolsar',
        403,
        'AAL2_REQUIRED'
      )
    }
  }

  return { id: user.id, email: user.email }
}

export async function consumeAdminRateLimit(
  userId: string,
  action: string,
  secret: string,
  limit: number,
  windowSeconds: number
): Promise<void> {
  const keyHash = createHmac('sha256', secret)
    .update(`${action}:${userId}`)
    .digest('hex')
  const service = createServiceRoleClient()
  const { data, error } = await service.rpc('commerce_consume_rate_limit', {
    p_key_hash: keyHash,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  })
  if (error) {
    throw new AdminRequestError(
      'No pudimos validar el límite de seguridad',
      503,
      'RATE_LIMIT_UNAVAILABLE'
    )
  }
  if (!data) {
    throw new AdminRequestError(
      'Demasiados intentos. Espera unos minutos.',
      429,
      'RATE_LIMITED'
    )
  }
}

export function adminErrorResponse(error: unknown): {
  message: string
  code: string
  status: number
} {
  if (error instanceof AdminRequestError) {
    return { message: error.message, code: error.code, status: error.status }
  }
  return {
    message: 'No pudimos completar la operación',
    code: 'INTERNAL_ERROR',
    status: 500,
  }
}
