import { NextResponse } from 'next/server'
import { getAddressConfig } from '@/lib/env/server'
import {
  AddressServiceError,
  assertTrustedAddressRequest,
  autocompleteAddress,
  readAddressJson,
} from '@/lib/commerce/address-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const config = getAddressConfig()
    assertTrustedAddressRequest(config, request)
    const result = await autocompleteAddress(config, request, await readAddressJson(request))
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch (error) {
    if (error instanceof AddressServiceError) {
      return NextResponse.json(
        { error: error.publicMessage, code: error.code },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    console.error('address_autocomplete_failed', { reason: 'unexpected_error' })
    return NextResponse.json(
      { error: 'No pudimos buscar direcciones.', code: 'INTERNAL_ERROR' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
