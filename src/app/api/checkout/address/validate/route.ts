import { NextResponse } from 'next/server'
import { getAddressConfig } from '@/lib/env/server'
import {
  AddressServiceError,
  assertTrustedAddressRequest,
  readAddressJson,
  validateAddressSelection,
} from '@/lib/commerce/address-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const config = getAddressConfig()
    assertTrustedAddressRequest(config, request)
    const result = await validateAddressSelection(config, request, await readAddressJson(request))
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch (error) {
    if (error instanceof AddressServiceError) {
      return NextResponse.json(
        { error: error.publicMessage, code: error.code },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    console.error('address_validation_failed', { reason: 'unexpected_error' })
    return NextResponse.json(
      { error: 'No pudimos validar la dirección.', code: 'INTERNAL_ERROR' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
