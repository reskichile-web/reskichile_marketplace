import { NextResponse } from 'next/server'
import { isSkiRackStorefrontEnabled } from '@/lib/ski-rack-visibility'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { enabled: isSkiRackStorefrontEnabled() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
