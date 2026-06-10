import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import RedeemInviteForm from './RedeemInviteForm'
import TrackInviteOpen from '@/components/TrackInviteOpen'

export const dynamic = 'force-dynamic'

interface Props {
  params: { slug: string }
}

export default async function InviteRedeemPage({ params }: Props) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: invite } = await admin
    .from('password_invites')
    .select('slug, user_id, expires_at, used_at')
    .eq('slug', params.slug)
    .maybeSingle()

  const expired = invite && new Date(invite.expires_at).getTime() < Date.now()
  const used = invite && invite.used_at !== null

  if (!invite || expired || used) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <h1 className="font-body text-2xl font-black text-gray-900 mb-3">Link inválido</h1>
          <p className="text-sm text-gray-500 mb-6">
            {used
              ? 'Este link ya fue utilizado.'
              : expired
                ? 'Este link expiró.'
                : 'No encontramos este link.'}
            {' '}
            Pide a un administrador que te envíe uno nuevo.
          </p>
          <Link
            href="/auth/login"
            className="inline-block bg-brand-500 text-white px-6 py-2.5 rounded-sm hover:bg-brand-600 transition-colors text-sm font-medium"
          >
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  const { data: profile } = await admin
    .from('users')
    .select('email, name')
    .eq('id', invite.user_id)
    .single()

  const firstName = profile?.name?.split(' ')[0] || ''

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <TrackInviteOpen slug={params.slug} />
      <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
        <h1 className="font-body text-2xl font-black text-gray-900">
          {firstName ? `Bienvenido, ${firstName}` : 'Bienvenido a ReSkiChile'}
        </h1>
        <p className="text-sm text-gray-600 mt-3 leading-relaxed">
          Como publicaste con nosotros la temporada pasada y aún tienes productos activos, te creamos una cuenta para que puedas seguir gestionándolos sin volver a registrarte.
        </p>
        <p className="text-sm text-gray-600 mt-3 leading-relaxed">
          Solo falta que definas tu contraseña para terminar el registro.
        </p>
        {profile?.email && (
          <div className="mt-5 bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-bold">Cuenta</p>
            <p className="text-sm text-gray-800">{profile.email}</p>
          </div>
        )}

        <RedeemInviteForm slug={params.slug} />

        <p className="mt-6 text-xs text-gray-400 text-center leading-relaxed">
          Este link es seguro y único para ti. No lo compartas con nadie.
        </p>
      </div>
    </div>
  )
}
