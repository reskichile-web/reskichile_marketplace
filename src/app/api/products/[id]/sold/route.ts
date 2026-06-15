import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { markProductSold } from '@/lib/sold'

// In-app "mark as sold" from the seller's own product (mis-productos / detail).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const salePrice = typeof body.sale_price === 'number' ? body.sale_price : null
  const soldChannel = typeof body.sold_channel === 'string' ? body.sold_channel : null
  const soldSpeed = typeof body.sold_speed === 'string' ? body.sold_speed : null

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Authorize: the caller must own this product.
  const { data: owned } = await admin
    .from('products')
    .select('id, seller_id, status')
    .eq('id', params.id)
    .single()
  if (!owned || owned.seller_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  if (!['approved', 'pending'].includes(owned.status)) {
    return NextResponse.json({ error: 'Esta publicación no se puede marcar como vendida' }, { status: 400 })
  }

  const result = await markProductSold(admin, params.id, {
    salePrice,
    soldChannel,
    soldSpeed,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
