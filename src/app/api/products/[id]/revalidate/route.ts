import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidateProduct } from '@/lib/revalidate'
import { NextResponse } from 'next/server'

// Called by the owner after editing their listing so the public ISR page
// updates immediately instead of waiting for the revalidate window. Authorized:
// the caller must own the product (or be an admin).
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // RLS lets a seller read their own row; admins can read any. Fetch what we
  // need to authorize and to know which cached paths to purge.
  const { data: product } = await supabase
    .from('products')
    .select('id, slug, seller_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!product) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  if (product.seller_id !== user.id) {
    const { data: profile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  revalidateProduct({ id: product.id, slug: product.slug })
  return NextResponse.json({ ok: true })
}
