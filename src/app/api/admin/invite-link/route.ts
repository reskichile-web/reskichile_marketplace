import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reskichile.cl'
const SLUG_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L confusion

function generateSlug(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  let out = ''
  for (let i = 0; i < length; i++) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length]
  return out
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { email } = await request.json()
  if (!email) return NextResponse.json({ error: 'Falta email' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: targetUser, error: lookupErr } = await admin
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single()

  if (lookupErr || !targetUser) {
    return NextResponse.json({ error: 'No se encontró el usuario' }, { status: 404 })
  }

  // Try a few times in case of slug collision
  let slug = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    slug = generateSlug(8)
    const { error: insertErr } = await admin
      .from('password_invites')
      .insert({ slug, user_id: targetUser.id })
    if (!insertErr) break
    if (attempt === 4) {
      return NextResponse.json({ error: 'No se pudo generar el link' }, { status: 500 })
    }
  }

  const link = `${SITE_URL}/i/${slug}`
  return NextResponse.json({ link })
}
