import { NextRequest, NextResponse } from 'next/server'
import {
  AdminRequestError,
  adminErrorResponse,
  assertSameOrigin,
  readSmallJson,
} from '@/lib/admin-security'
import {
  createMarketingConsentDecision,
  type MarketingConsentChoice,
} from '@/lib/marketing-consent'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' }

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const body = await readSmallJson(request, 1024)
    const choice = body.choice
    if (choice !== 'granted' && choice !== 'denied') {
      throw new AdminRequestError('Preferencia inválida', 422, 'INVALID_CONSENT')
    }

    const supabase = createServerSupabaseClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new AdminRequestError('Autenticación requerida', 401, 'UNAUTHENTICATED')
    }

    const decision = createMarketingConsentDecision(choice as MarketingConsentChoice)
    const { error } = await supabase.auth.updateUser({
      data: { marketing_consent: decision },
    })
    if (error) throw new Error('marketing consent update failed')

    return NextResponse.json(
      { decision },
      { headers: NO_STORE },
    )
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json(
      { error: known.message, code: known.code },
      { status: known.status, headers: NO_STORE },
    )
  }
}
