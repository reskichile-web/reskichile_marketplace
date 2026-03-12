import { createServiceRoleClient } from '@/lib/supabase/server'
import { confirmTransaction } from '@/lib/transbank'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  return handleConfirmation(request)
}

export async function POST(request: Request) {
  return handleConfirmation(request)
}

async function handleConfirmation(request: Request) {
  const { searchParams } = new URL(request.url)
  const paymentId = searchParams.get('payment_id')

  // Webpay sends token_ws as query param (GET) or form body (POST)
  let tokenWs = searchParams.get('token_ws')

  if (!tokenWs && request.method === 'POST') {
    try {
      const formData = await request.formData()
      tokenWs = formData.get('token_ws') as string
    } catch {
      // ignore
    }
  }

  const supabase = createServiceRoleClient()
  const { origin } = new URL(request.url)

  if (!tokenWs || !paymentId) {
    // User cancelled or error
    if (paymentId) {
      await supabase
        .from('payments')
        .update({ status: 'rejected' })
        .eq('id', paymentId)
    }
    return NextResponse.redirect(`${origin}/pago/resultado?status=cancelled`)
  }

  try {
    const response = await confirmTransaction(tokenWs)

    // Save full response
    await supabase
      .from('payments')
      .update({
        transbank_response: response,
        status: response.response_code === 0 ? 'approved' : 'rejected',
      })
      .eq('id', paymentId)

    if (response.response_code === 0) {
      // Payment approved - move product to pending review
      const { data: payment } = await supabase
        .from('payments')
        .select('product_id')
        .eq('id', paymentId)
        .single()

      if (payment) {
        await supabase
          .from('products')
          .update({ status: 'pending' })
          .eq('id', payment.product_id)
      }

      return NextResponse.redirect(`${origin}/pago/resultado?status=approved`)
    } else {
      return NextResponse.redirect(`${origin}/pago/resultado?status=rejected`)
    }
  } catch (error) {
    console.error('Transbank confirm error:', error)
    await supabase
      .from('payments')
      .update({ status: 'error' })
      .eq('id', paymentId)

    return NextResponse.redirect(`${origin}/pago/resultado?status=error`)
  }
}
