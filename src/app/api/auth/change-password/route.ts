import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const { password } = await req.json()

  if (!password) {
    return NextResponse.json({ error: 'Contraseña requerida' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 })
  }

  // The caller can update only its own authenticated account. Never use the
  // service role for a password change keyed solely by an email address.
  const { error: authError } = await supabase.auth.updateUser({ password })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const { error: profileError } = await supabase
    .from('users')
    .update({ must_change_password: false })
    .eq('id', user.id)

  if (profileError) {
    return NextResponse.json({ error: 'Contraseña actualizada, pero no se pudo completar el perfil' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
