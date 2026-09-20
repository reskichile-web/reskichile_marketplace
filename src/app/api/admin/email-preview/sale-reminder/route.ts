import { NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-security'
import { buildSaleReminderEmail } from '@/lib/email/templates'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdmin()
    const service = createServiceRoleClient()
    const { data, error } = await service
      .from('products')
      .select('brand, model, price, product_images(url, "order")')
      .eq('status', 'approved')
      .order('updated_at', { ascending: false })
      .limit(20)

    if (error) throw error
    const product = (data || []).find(row => row.product_images?.length)
    if (!product) throw new Error('No approved product with an image')
    const imageUrl = product.product_images
      .slice()
      .sort((a, b) => a.order - b.order)[0]?.url ?? null

    const email = buildSaleReminderEmail({
      brand: product.brand,
      model: product.model,
      price: product.price,
      imageUrl,
      soldPath: '/p/vendi/vista-previa?alt=vista-previa-disponible',
      availablePath: '/p/disponible/vista-previa-disponible?alt=vista-previa',
    })

    return new NextResponse(email.html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, private',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json(
      { error: known.message, code: known.code },
      {
        status: known.status,
        headers: { 'Cache-Control': 'no-store, private' },
      },
    )
  }
}
