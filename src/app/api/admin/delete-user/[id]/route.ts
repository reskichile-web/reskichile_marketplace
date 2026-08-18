import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: targetId } = await params
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  if (!targetId) return NextResponse.json({ error: 'Falta id' }, { status: 400 })
  if (targetId === user.id) {
    return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: target, error: lookupErr } = await admin
    .from('users')
    .select('id, is_admin')
    .eq('id', targetId)
    .single()
  if (lookupErr || !target) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }
  if (target.is_admin) {
    return NextResponse.json({ error: 'No se puede eliminar a otro admin' }, { status: 400 })
  }

  // Deleting the auth user cascades to public.users, which in turn cascades to
  // products (and product_images), conversations, messages, and password_invites.
  const { error: deleteErr } = await admin.auth.admin.deleteUser(targetId)
  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
