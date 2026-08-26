import { NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-security'
import { adminPageMeta, parseAdminPageParams, sanitizeAdminSearch } from '@/lib/admin-pagination'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PRODUCT_SELECT = 'id, slug, product_type, brand, model, price, sale_price, status, created_at, days_published, sale_reminder_sent_at, seller_id, condition, region, comuna, description, rejection_reason, attributes, anon_contact, users(name, email, phone, hide_phone), product_images(url, order)'

async function findMatchingProductIds(search: string): Promise<string[]> {
  const service = createServiceRoleClient()
  const [productMatches, userMatches] = await Promise.all([
    service
      .from('products')
      .select('id')
      .or(`brand.ilike.%${search}%,model.ilike.%${search}%`)
      .limit(2000),
    service
      .from('users')
      .select('id')
      .or(`name.ilike.%${search}%,email.ilike.%${search}%`)
      .limit(500),
  ])
  if (productMatches.error || userMatches.error) throw new Error('admin product search failed')

  const sellerIds = (userMatches.data || []).map(row => row.id)
  const sellerProducts = sellerIds.length > 0
    ? await service.from('products').select('id').in('seller_id', sellerIds).limit(2000)
    : { data: [] as Array<{ id: string }>, error: null }
  if (sellerProducts.error) throw new Error('admin seller search failed')

  return [...new Set([
    ...(productMatches.data || []).map(row => row.id),
    ...(sellerProducts.data || []).map(row => row.id),
  ])]
}

export async function GET(request: Request) {
  try {
    await requireAdmin()
    const service = createServiceRoleClient()
    const searchParams = new URL(request.url).searchParams
    const { offset, limit } = parseAdminPageParams(searchParams)
    const status = sanitizeAdminSearch(searchParams.get('status'), 40)
    const brand = sanitizeAdminSearch(searchParams.get('brand'))
    const productType = sanitizeAdminSearch(searchParams.get('type'), 40)
    const search = sanitizeAdminSearch(searchParams.get('search'))
    const matchingIds = search ? await findMatchingProductIds(search) : null

    let query = service
      .from('products')
      .select(PRODUCT_SELECT, { count: 'exact' })
    if (status && status !== 'all') query = query.eq('status', status)
    if (brand) query = query.eq('brand', brand)
    if (productType) query = query.eq('product_type', productType)
    if (matchingIds) {
      query = matchingIds.length > 0
        ? query.in('id', matchingIds)
        : query.eq('id', '00000000-0000-0000-0000-000000000000')
    }

    const facetsPromise = offset === 0
      ? service.from('products').select('status, brand')
      : Promise.resolve({ data: null, error: null })
    const [productsResult, facetsResult] = await Promise.all([
      query
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .order('order', { referencedTable: 'product_images', ascending: true })
        .range(offset, offset + limit - 1),
      facetsPromise,
    ])
    if (productsResult.error || facetsResult.error) throw new Error('admin products query failed')

    const products = productsResult.data || []
    const pageIds = products.map(product => product.id)
    const viewCounts: Record<string, number> = {}
    if (pageIds.length > 0) {
      const { data: counts, error: countsError } = await service.rpc('product_view_counts', {
        p_ids: pageIds,
      })
      if (!countsError) {
        for (const row of counts || []) viewCounts[row.product_id] = Number(row.views)
      }
    }

    let facets: { statusCounts: Record<string, number>; brands: string[] } | null = null
    if (facetsResult.data) {
      const statusCounts: Record<string, number> = { all: facetsResult.data.length }
      const brands = new Set<string>()
      for (const row of facetsResult.data) {
        statusCounts[row.status] = (statusCounts[row.status] || 0) + 1
        if (row.brand) brands.add(row.brand)
      }
      facets = {
        statusCounts,
        brands: [...brands].sort((left, right) => left.localeCompare(right, 'es')),
      }
    }

    return NextResponse.json({
      products,
      viewCounts,
      facets,
      ...adminPageMeta(productsResult.count || 0, offset, products.length),
    }, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json(
      { error: known.message, code: known.code },
      { status: known.status, headers: { 'Cache-Control': 'no-store, private' } },
    )
  }
}
