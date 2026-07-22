import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { phoneToWhatsApp } from '@/lib/phone'

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10 // max contacts per window
const RATE_WINDOW = 60 * 60 * 1000 // 1 hour

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW })
    return false
  }

  if (entry.count >= RATE_LIMIT) {
    return true
  }

  entry.count++
  return false
}

export async function POST(
  request: Request,
  { params }: { params: { productId: string } }
) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (isRateLimited(user.id)) {
    return NextResponse.json(
      { error: 'Has excedido el límite de contactos. Intenta más tarde.' },
      { status: 429 }
    )
  }

  // Get product with seller info
  const { data: product } = await supabase
    .from('products')
    .select('id, slug, brand, model, product_type, seller_id, anon_contact, status')
    .eq('id', params.productId)
    .eq('status', 'approved')
    .single()

  if (!product) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }

  if (product.seller_id === user.id) {
    return NextResponse.json({ error: 'No puedes contactarte a ti mismo' }, { status: 400 })
  }

  // Resolve the registered seller's phone or, for legacy/anonymous listings,
  // the contact stored directly on the product. There is deliberately no
  // fallback number: WhatsApp must always target this listing's seller.
  const service = createServiceRoleClient()
  let phone: string | null = null

  if (product.seller_id) {
    // Cross-user profile fields are private under RLS, so a buyer cannot read
    // the seller's phone with their own session. This server-only lookup uses
    // the service role after the buyer and approved product were validated.
    const { data: seller } = await service
      .from('users')
      .select('phone, hide_phone')
      .eq('id', product.seller_id)
      .single()

    if (seller?.hide_phone) {
      // Seller opted out — refuse to hand out a number even if the client
      // bypasses the UI gate. Frontend hides the button, this is just belt
      // and braces.
      return NextResponse.json(
        { error: 'El vendedor optó por no compartir su número' },
        { status: 403 }
      )
    }

    const wa = phoneToWhatsApp(seller?.phone)
    if (wa) phone = wa
  } else {
    const wa = phoneToWhatsApp(product.anon_contact)
    if (wa) phone = wa
  }

  if (!phone) {
    return NextResponse.json(
      { error: 'Esta publicación no tiene un número de WhatsApp válido' },
      { status: 422 }
    )
  }

  // Build WhatsApp URL with pre-filled message
  const productName = [product.brand, product.model].filter(Boolean).join(' ')
  const message = encodeURIComponent(
    `Hola, te contacto por "${productName}" en ReskiChile`
  )
  const url = `https://wa.me/${phone}?text=${message}`

  // This is the authoritative WhatsApp handoff: validation passed and a real
  // seller number was resolved. Store it here (rather than as a client beacon)
  // so the admin feed and metrics never miss it during the external redirect.
  // Admin activity remains excluded, consistently with the rest of analytics.
  const { data: buyerProfile } = await service
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!buyerProfile?.is_admin) {
    const cityRaw = request.headers.get('x-vercel-ip-city')
    let city: string | null = null
    if (cityRaw) {
      try { city = decodeURIComponent(cityRaw) } catch { city = cityRaw }
    }

    await service.from('events').insert({
      event_type: 'click',
      event_name: 'whatsapp_contact',
      path: `/producto/${product.slug || product.id}`,
      category: product.product_type,
      product_id: product.id,
      user_id: user.id,
      referrer: request.headers.get('referer')?.slice(0, 500) || null,
      user_agent: request.headers.get('user-agent')?.slice(0, 300) || null,
      country: request.headers.get('x-vercel-ip-country'),
      city,
    })
  }

  return NextResponse.json({ url })
}
