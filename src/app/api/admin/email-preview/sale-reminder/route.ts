import { NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-security'
import { buildSaleReminderEmail } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdmin()

    const email = buildSaleReminderEmail({
      brand: 'Rossignol',
      model: 'Experience 88 Ti',
      price: 349_990,
      imageUrl: 'https://www.reskichile.cl/images/ski-landing.jpeg',
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
