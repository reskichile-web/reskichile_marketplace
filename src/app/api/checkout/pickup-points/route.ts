import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PICKUP_DESCRIPTION = 'Te contactaremos para coordinar el retiro.'

export async function GET() {
  const service = createServiceRoleClient()
  const { data, error } = await service
    .from('shipping_origins')
    .select('code, pickup_label, pickup_address, region, commune')
    .eq('active', true)
    .eq('pickup_enabled', true)
    .order('display_name', { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: 'No pudimos cargar los puntos de retiro.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const points = (data || []).flatMap(point => {
    if (
      !point.code || !point.pickup_label || !point.pickup_address ||
      !point.region || !point.commune
    ) return []
    return [{
      id: String(point.code),
      label: String(point.pickup_label),
      address: String(point.pickup_address),
      description: PICKUP_DESCRIPTION,
      region: String(point.region),
      commune: String(point.commune),
    }]
  })

  return NextResponse.json(
    { points },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  )
}
