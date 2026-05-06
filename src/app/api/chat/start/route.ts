import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const productId: string | undefined = body.product_id
  if (!productId) {
    return NextResponse.json({ error: 'Missing product_id' }, { status: 400 })
  }

  const { data: product } = await supabase
    .from('products')
    .select('id, seller_id')
    .eq('id', productId)
    .single()

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }
  if (!product.seller_id) {
    return NextResponse.json({ error: 'Seller is anonymous' }, { status: 400 })
  }
  if (product.seller_id === user.id) {
    return NextResponse.json({ error: 'Cannot chat with yourself' }, { status: 400 })
  }

  // Try to find existing conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('product_id', productId)
    .eq('buyer_id', user.id)
    .eq('seller_id', product.seller_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ conversation_id: existing.id })
  }

  // Create
  const { data: created, error } = await supabase
    .from('conversations')
    .insert({
      product_id: productId,
      buyer_id: user.id,
      seller_id: product.seller_id,
    })
    .select('id')
    .single()

  if (error || !created) {
    return NextResponse.json({ error: error?.message || 'Insert failed' }, { status: 500 })
  }

  return NextResponse.json({ conversation_id: created.id })
}
