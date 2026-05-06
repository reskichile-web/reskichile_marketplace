import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const PASSWORD_MIN = 6

export async function POST(request: Request) {
  let body: { slug?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const { slug, password } = body
  if (!slug || !password) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }
  if (password.length < PASSWORD_MIN || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({ error: 'Contraseña no cumple los requisitos' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: invite } = await admin
    .from('password_invites')
    .select('slug, user_id, expires_at, used_at')
    .eq('slug', slug)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: 'Link no encontrado' }, { status: 404 })
  if (invite.used_at) return NextResponse.json({ error: 'Link ya utilizado' }, { status: 410 })
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Link expirado' }, { status: 410 })
  }

  // Update auth password via service role
  const { error: updErr } = await admin.auth.admin.updateUserById(invite.user_id, { password })
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  // Mark slug used + clear must_change_password
  await admin.from('password_invites').update({ used_at: new Date().toISOString() }).eq('slug', slug)
  await admin.from('users').update({ must_change_password: false }).eq('id', invite.user_id)

  // Return email so the client can sign in to set its own cookies
  const { data: profile } = await admin
    .from('users')
    .select('email')
    .eq('id', invite.user_id)
    .single()

  return NextResponse.json({ email: profile?.email })
}
