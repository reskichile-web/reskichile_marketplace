import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { normalizeStoredPhone, parseAndValidatePhone } from '@/lib/phone'

const PASSWORD_MIN = 6

export async function POST(request: Request) {
  let body: { slug?: string; password?: string; phone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const { slug, password, phone } = body
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

  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('email, phone')
    .eq('id', invite.user_id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'No se encontró el perfil' }, { status: 404 })
  }

  const storedPhone = normalizeStoredPhone(profile.phone)
  const submittedPhone = phone ? parseAndValidatePhone(phone) : null
  if (!storedPhone && !submittedPhone) {
    return NextResponse.json({ error: 'Teléfono requerido' }, { status: 400 })
  }

  // Update auth password via service role
  const { error: updErr } = await admin.auth.admin.updateUserById(invite.user_id, { password })
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  // Redeeming the invite is the explicit opt-in for an imported account:
  // clear the temporary-password flag and move the user from inactive to
  // active. Do this before consuming the link so a transient profile-write
  // failure can be retried with the same invite.
  const activationValues: Record<string, boolean | string> = {
    must_change_password: false,
    keep: true,
  }
  if (!storedPhone && submittedPhone) activationValues.phone = submittedPhone

  const { error: activationError } = await admin
    .from('users')
    .update(activationValues)
    .eq('id', invite.user_id)

  if (activationError) {
    return NextResponse.json({ error: 'No se pudo activar la cuenta' }, { status: 500 })
  }

  const { error: consumeError } = await admin
    .from('password_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('slug', slug)

  if (consumeError) {
    return NextResponse.json({ error: 'No se pudo completar la invitación' }, { status: 500 })
  }

  // Analytics: an invite redemption is an activation (no visitor cookie here)
  await admin.from('events').insert({
    event_type: 'signup',
    event_name: 'invite_redeem',
    path: `/i/${slug}`,
    user_id: invite.user_id,
    visitor_id: null,
  })

  // Return email so the client can sign in to set its own cookies.
  return NextResponse.json({ email: profile?.email })
}
