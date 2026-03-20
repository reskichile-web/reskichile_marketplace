import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Find user in our table
  const { data: userRecord } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .single()

  if (!userRecord) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  // Update password in Supabase Auth using admin API
  const { error: authError } = await supabase.auth.admin.updateUserById(userRecord.id, {
    password,
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  // Clear must_change_password flag
  await supabase
    .from('users')
    .update({ must_change_password: false })
    .eq('id', userRecord.id)

  return NextResponse.json({ success: true })
}
