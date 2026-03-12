import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createTransaction } from '@/lib/transbank'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { productId } = await request.json()

  if (!productId) {
    return NextResponse.json({ error: 'Falta productId' }, { status: 400 })
  }

  // Verify product belongs to user and is in draft status
  const { data: product } = await supabase
    .from('products')
    .select('id, seller_id, status')
    .eq('id', productId)
    .eq('seller_id', user.id)
    .eq('status', 'draft')
    .single()

  if (!product) {
    return NextResponse.json({ error: 'Producto no encontrado o no disponible para pago' }, { status: 404 })
  }

  const amount = parseInt(process.env.PUBLICATION_FEE_CLP || '5000')

  // Create payment record
  const buyOrder = `RC-${Date.now()}`
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      user_id: user.id,
      product_id: productId,
      amount,
      status: 'pending',
    })
    .select()
    .single()

  if (paymentError || !payment) {
    return NextResponse.json({ error: 'Error al crear pago' }, { status: 500 })
  }

  try {
    const { origin } = new URL(request.url)
    const returnUrl = `${origin}/api/payment/confirm?payment_id=${payment.id}`

    const response = await createTransaction(
      buyOrder,
      payment.id,
      amount,
      returnUrl
    )

    // Save transbank token
    await supabase
      .from('payments')
      .update({ transbank_token: response.token })
      .eq('id', payment.id)

    return NextResponse.json({
      url: response.url,
      token: response.token,
    })
  } catch (error) {
    console.error('Transbank error:', error)
    await supabase
      .from('payments')
      .update({ status: 'error' })
      .eq('id', payment.id)

    return NextResponse.json({ error: 'Error al crear transacción' }, { status: 500 })
  }
}
