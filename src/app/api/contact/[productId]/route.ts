import { createHmac } from 'crypto'
import { AdminRequestError, adminErrorResponse, assertSameOrigin, readSmallJson } from '@/lib/admin-security'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { phoneToWhatsApp } from '@/lib/phone'
import { sanitizeCampaignAttribution } from '@/lib/campaign-attribution'
import { readVisitorId } from '@/lib/visitor'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BOT_RE = /bot|crawl|spider|preview|lighthouse|headless|monitor|scrape|curl|wget/i
const RATE_WINDOW_SECONDS = 60 * 60
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, private' }

function contactError(message: string, status: number, code: string): never {
  throw new AdminRequestError(message, status, code)
}

function clientAddress(request: Request): string {
  // Vercel overwrites x-forwarded-for with the connecting public IP. Prefer it
  // over the longer forwarding chain so a caller cannot choose its own bucket.
  return (
    request.headers.get('x-forwarded-for')?.split(',', 1)[0]
    || request.headers.get('x-vercel-forwarded-for')?.split(',', 1)[0]
    || request.headers.get('x-real-ip')
    || 'local'
  ).trim().slice(0, 64)
}

function rateLimitSecret(): string {
  const secret = (
    process.env.CONTACT_RATE_LIMIT_SECRET
    || process.env.CHECKOUT_RATE_LIMIT_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || ''
  ).trim()
  if (secret.length < 32) {
    contactError('Contacto temporalmente no disponible', 503, 'RATE_LIMIT_UNAVAILABLE')
  }
  return secret
}

function rateLimitKey(secret: string, scope: string, value: string): string {
  return createHmac('sha256', secret)
    .update(`whatsapp-contact:${scope}:${value}`)
    .digest('hex')
}

async function consumeContactRateLimits({
  request,
  productId,
  visitorId,
  userId,
}: {
  request: Request
  productId: string
  visitorId: string | null
  userId: string | null
}): Promise<void> {
  const secret = rateLimitSecret()
  const ip = clientAddress(request)
  const actor = userId ? `user:${userId}` : `visitor:${visitorId || ip}`
  const buckets = [
    { scope: 'ip', value: ip, limit: 30 },
    { scope: 'actor', value: actor, limit: 10 },
    { scope: 'actor-product', value: `${actor}:${productId}`, limit: 3 },
  ] as const
  const service = createServiceRoleClient()
  const results = await Promise.all(buckets.map((bucket) => service.rpc(
    'commerce_consume_rate_limit',
    {
      p_key_hash: rateLimitKey(secret, bucket.scope, bucket.value),
      p_window_seconds: RATE_WINDOW_SECONDS,
      p_limit: bucket.limit,
    },
  )))

  if (results.some(({ error }) => error)) {
    console.error('[contact] persistent rate limit unavailable')
    contactError('No pudimos validar el límite de seguridad', 503, 'RATE_LIMIT_UNAVAILABLE')
  }
  if (results.some(({ data }) => data !== true)) {
    contactError('Demasiados contactos. Espera antes de volver a intentar.', 429, 'RATE_LIMITED')
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    assertSameOrigin(request)
    const { productId } = await params
    if (!UUID_RE.test(productId)) {
      contactError('Producto inválido', 422, 'INVALID_PRODUCT')
    }
    if (BOT_RE.test(request.headers.get('user-agent') || '')) {
      contactError('Solicitud no permitida', 403, 'AUTOMATION_BLOCKED')
    }

    const body = await readSmallJson(request, 2048)
    const attribution = sanitizeCampaignAttribution(body.attribution)
    const visitorId = readVisitorId(request)
    const supabase = createServerSupabaseClient()
    let user: { id: string } | null = null
    try {
      const auth = await supabase.auth.getUser()
      user = auth.data.user ? { id: auth.data.user.id } : null
    } catch {
      // Authentication is optional for WhatsApp. A session outage must not
      // recreate the same hard gate for legitimate guest buyers.
    }

    await consumeContactRateLimits({
      request,
      productId,
      visitorId,
      userId: user?.id || null,
    })

    // Use the service client only on the server and select the minimum fields
    // needed to resolve an approved listing's contact destination.
    const service = createServiceRoleClient()
    const { data: product, error: productError } = await service
      .from('products')
      .select('id, slug, brand, model, product_type, seller_id, anon_contact, status')
      .eq('id', productId)
      .eq('status', 'approved')
      .maybeSingle()

    if (productError) throw new Error('contact product lookup failed')
    if (!product) contactError('Producto no encontrado', 404, 'PRODUCT_NOT_FOUND')
    if (user && product.seller_id === user.id) {
      contactError('No puedes contactarte a ti mismo', 400, 'SELF_CONTACT')
    }

    let phone: string | null = null
    if (product.seller_id) {
      const { data: seller, error: sellerError } = await service
        .from('users')
        .select('phone, hide_phone')
        .eq('id', product.seller_id)
        .maybeSingle()

      if (sellerError) throw new Error('contact seller lookup failed')
      if (seller?.hide_phone) {
        contactError('El vendedor optó por no compartir su número', 403, 'PHONE_HIDDEN')
      }
      phone = phoneToWhatsApp(seller?.phone)
    } else {
      phone = phoneToWhatsApp(product.anon_contact)
    }

    if (!phone) {
      contactError(
        'Esta publicación no tiene un número de WhatsApp válido',
        422,
        'PHONE_UNAVAILABLE',
      )
    }

    const productName = [product.brand, product.model].filter(Boolean).join(' ')
    const message = encodeURIComponent(`Hola, te contacto por "${productName}" en ReskiChile`)
    const url = `https://wa.me/${phone}?text=${message}`

    let shouldRecordAnalytics = !user
    if (user) {
      const { data: buyerProfile, error: buyerProfileError } = await service
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle()
      // If this authorization lookup is unavailable, preserve the contact but
      // skip analytics so admin activity is never accidentally counted.
      shouldRecordAnalytics = !buyerProfileError && buyerProfile?.is_admin !== true
    }

    if (shouldRecordAnalytics) {
      const cityRaw = request.headers.get('x-vercel-ip-city')
      let city: string | null = null
      if (cityRaw) {
        try { city = decodeURIComponent(cityRaw) } catch { city = cityRaw }
      }

      const { error: eventError } = await service.from('events').insert({
        event_type: 'click',
        event_name: 'whatsapp_contact',
        path: `/producto/${product.slug || product.id}`,
        category: product.product_type,
        product_id: product.id,
        visitor_id: visitorId,
        user_id: user?.id || null,
        referrer: request.headers.get('referer')?.slice(0, 500) || null,
        user_agent: request.headers.get('user-agent')?.slice(0, 300) || null,
        country: request.headers.get('x-vercel-ip-country'),
        city,
        ...(attribution ?? {}),
      })
      if (eventError) console.error('[contact] analytics insert failed:', eventError.message)
    }

    return NextResponse.json({ url }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    const known = adminErrorResponse(error)
    if (!(error instanceof AdminRequestError)) {
      console.error('[contact] unexpected failure:', error)
    }
    return NextResponse.json(
      { error: known.message, code: known.code },
      { status: known.status, headers: NO_STORE_HEADERS },
    )
  }
}
