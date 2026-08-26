import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizeStoredPhone } from '@/lib/phone'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email) {
    return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check if user exists in our users table
  const { data: user } = await supabase
    .from('users')
    .select('id, email, phone, must_change_password')
    .eq('email', email.trim().toLowerCase())
    .single()

  if (user) {
    return NextResponse.json({
      exists: true,
      must_change_password: user.must_change_password,
      needs_phone: !normalizeStoredPhone(user.phone),
    })
  }

  return NextResponse.json({ exists: false })
}
