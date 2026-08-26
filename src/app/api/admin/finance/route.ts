import { NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-security'
import { adminPageMeta, parseAdminPageParams, sanitizeAdminSearch } from '@/lib/admin-pagination'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface FinanceMetadataRow {
  product_type: string
  status: string
  price: number
}

export async function GET(request: Request) {
  try {
    await requireAdmin()
    const service = createServiceRoleClient()
    const searchParams = new URL(request.url).searchParams
    const { offset, limit } = parseAdminPageParams(searchParams)
    const productType = sanitizeAdminSearch(searchParams.get('type'), 40)
    const search = sanitizeAdminSearch(searchParams.get('search'))

    let matchingIds: string[] | null = null
    if (search) {
      const [productMatches, userMatches] = await Promise.all([
        service
          .from('products')
          .select('id')
          .eq('status', 'sold')
          .or(`brand.ilike.%${search}%,model.ilike.%${search}%,anon_contact.ilike.%${search}%`)
          .limit(2000),
        service
          .from('users')
          .select('id')
          .or(`name.ilike.%${search}%,email.ilike.%${search}%`)
          .limit(500),
      ])
      const sellerIds = (userMatches.data || []).map(row => row.id)
      const sellerProducts = sellerIds.length > 0
        ? await service.from('products').select('id').eq('status', 'sold').in('seller_id', sellerIds).limit(2000)
        : { data: [] as Array<{ id: string }> }
      matchingIds = [...new Set([
        ...(productMatches.data || []).map(row => row.id),
        ...(sellerProducts.data || []).map(row => row.id),
      ])]
    }

    let soldQuery = service
      .from('products')
      .select('id, product_type, brand, model, condition, region, price, sale_price, created_at, updated_at, anon_contact, slug, users(name, email, phone)', { count: 'exact' })
      .eq('status', 'sold')
    if (productType) soldQuery = soldQuery.eq('product_type', productType)
    if (matchingIds) {
      if (matchingIds.length === 0) {
        soldQuery = soldQuery.eq('id', '00000000-0000-0000-0000-000000000000')
      } else {
        soldQuery = soldQuery.in('id', matchingIds)
      }
    }

    let summaryQuery = service
      .from('products')
      .select('price, sale_price')
      .eq('status', 'sold')
    if (productType) summaryQuery = summaryQuery.eq('product_type', productType)
    if (matchingIds) {
      summaryQuery = matchingIds.length > 0
        ? summaryQuery.in('id', matchingIds)
        : summaryQuery.eq('id', '00000000-0000-0000-0000-000000000000')
    }

    const metadataPromise = offset === 0
      ? service
        .from('products')
        .select('product_type, status, price')
        .in('status', ['pending', 'approved', 'sold', 'archived'])
      : Promise.resolve({ data: null, error: null })

    const [soldResult, metadataResult, summaryResult] = await Promise.all([
      soldQuery
        .order('updated_at', { ascending: false })
        .order('id', { ascending: true })
        .range(offset, offset + limit - 1),
      metadataPromise,
      offset === 0 ? summaryQuery : Promise.resolve({ data: null, error: null }),
    ])
    if (soldResult.error || metadataResult.error || summaryResult.error) throw new Error('admin finance query failed')

    const sold = soldResult.data || []
    const summaryRows = summaryResult.data || []
    return NextResponse.json({
      sold,
      metadata: (metadataResult.data || null) as FinanceMetadataRow[] | null,
      summary: summaryResult.data ? {
        total: summaryRows.length,
        totalListing: summaryRows.reduce((sum, row) => sum + Number(row.price), 0),
        soldWithPrice: summaryRows.filter(row => row.sale_price != null).length,
        totalSale: summaryRows.reduce((sum, row) => sum + Number(row.sale_price || 0), 0),
      } : null,
      ...adminPageMeta(soldResult.count || 0, offset, sold.length),
    }, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json(
      { error: known.message, code: known.code },
      { status: known.status, headers: { 'Cache-Control': 'no-store, private' } },
    )
  }
}
