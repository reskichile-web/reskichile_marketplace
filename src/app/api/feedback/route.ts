import { createHash, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  AdminRequestError,
  adminErrorResponse,
  assertSameOrigin,
  readSmallJson,
} from '@/lib/admin-security'
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN_PATTERN = /^[0-9a-f]{64}$/i

function clientAddress(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'local'
}

async function consumeFeedbackRateLimit(request: NextRequest, identity?: string) {
  const keyHash = createHash('sha256')
    .update(`feedback:${identity || clientAddress(request)}`)
    .digest('hex')
  const service = createServiceRoleClient()
  const { data, error } = await service.rpc('commerce_consume_rate_limit', {
    p_key_hash: keyHash,
    p_window_seconds: 600,
    p_limit: 6,
  })

  if (error) {
    throw new AdminRequestError('No pudimos enviar tu comentario', 503, 'RATE_LIMIT_UNAVAILABLE')
  }
  if (!data) {
    throw new AdminRequestError('Espera unos minutos antes de enviar otro comentario', 429, 'RATE_LIMITED')
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const body = await readSmallJson(request, 4096)
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const pagePath = typeof body.pagePath === 'string' ? body.pagePath.trim() : ''

    if (message.length < 2 || message.length > 1000) {
      throw new AdminRequestError('Escribe un comentario breve', 422, 'INVALID_MESSAGE')
    }
    if (pagePath && (!pagePath.startsWith('/') || pagePath.length > 500)) {
      throw new AdminRequestError('Página inválida', 422, 'INVALID_PAGE')
    }

    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    await consumeFeedbackRateLimit(request, user?.id)

    const ratingToken = randomBytes(32).toString('hex')
    const ratingTokenHash = createHash('sha256').update(ratingToken).digest('hex')
    const service = createServiceRoleClient()
    const { data, error } = await service
      .from('feedback_comments')
      .insert({
        user_id: user?.id || null,
        message,
        page_path: pagePath || null,
        rating_token_hash: ratingTokenHash,
      })
      .select('id')
      .single()

    if (error || !data) throw new Error('feedback insert failed')

    return NextResponse.json(
      { id: data.id, ratingToken },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json(
      { error: known.message, code: known.code },
      { status: known.status, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const body = await readSmallJson(request, 2048)
    const id = typeof body.id === 'string' ? body.id : ''
    const ratingToken = typeof body.ratingToken === 'string' ? body.ratingToken : ''
    const rating = Number(body.rating)

    if (!UUID_PATTERN.test(id) || !TOKEN_PATTERN.test(ratingToken)) {
      throw new AdminRequestError('Comentario inválido', 422, 'INVALID_FEEDBACK')
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new AdminRequestError('Calificación inválida', 422, 'INVALID_RATING')
    }

    const ratingTokenHash = createHash('sha256').update(ratingToken).digest('hex')
    const service = createServiceRoleClient()
    const { data, error } = await service
      .from('feedback_comments')
      .update({ rating, rated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('rating_token_hash', ratingTokenHash)
      .select('id')
      .maybeSingle()

    if (error) throw new Error('feedback rating update failed')
    if (!data) throw new AdminRequestError('Comentario no encontrado', 404, 'FEEDBACK_NOT_FOUND')

    return NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json(
      { error: known.message, code: known.code },
      { status: known.status, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
