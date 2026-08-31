import { NextResponse } from 'next/server'
import {
  AdminRequestError,
  adminErrorResponse,
  assertSameOrigin,
  requireAdmin,
} from '@/lib/admin-security'
import { sendSaleReminderForProductId } from '@/lib/sale-reminder-email'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ERROR_STATUS = {
  PRODUCT_NOT_FOUND: 404,
  NO_RECIPIENT: 422,
  TOKEN_CREATE_FAILED: 500,
  EMAIL_SEND_FAILED: 502,
} as const

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    await requireAdmin()

    const { id } = await params
    if (!UUID_RE.test(id)) {
      throw new AdminRequestError('Producto inválido', 422, 'INVALID_PRODUCT_ID')
    }

    const result = await sendSaleReminderForProductId(createServiceRoleClient(), id)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        {
          status: ERROR_STATUS[result.code],
          headers: { 'Cache-Control': 'no-store, private' },
        },
      )
    }

    return NextResponse.json(
      {
        ok: true,
        sentAt: result.sentAt,
        trackingUpdated: result.trackingUpdated,
      },
      { headers: { 'Cache-Control': 'no-store, private' } },
    )
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json(
      { error: known.message, code: known.code },
      {
        status: known.status,
        headers: { 'Cache-Control': 'no-store, private' },
      },
    )
  }
}
