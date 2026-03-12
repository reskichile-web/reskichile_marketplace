import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
    .select('id, brand, model, seller_id, status')
    .eq('id', params.productId)
    .eq('status', 'approved')
    .single()

  if (!product) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }

  if (product.seller_id === user.id) {
    return NextResponse.json({ error: 'No puedes contactarte a ti mismo' }, { status: 400 })
  }

  // Get seller phone (server-side only - never exposed to client)
  const { data: seller } = await supabase
    .from('users')
    .select('phone')
    .eq('id', product.seller_id)
    .single()

  if (!seller?.phone) {
    return NextResponse.json(
      { error: 'El vendedor no tiene número de contacto registrado' },
      { status: 400 }
    )
  }

  // Build WhatsApp URL with pre-filled message
  const productName = [product.brand, product.model].filter(Boolean).join(' ')
  const message = encodeURIComponent(
    `Hola, te contacto por "${productName}" en ReskiChile`
  )
  const phone = seller.phone.replace(/\D/g, '')
  const url = `https://wa.me/${phone}?text=${message}`

  return NextResponse.json({ url })
}
