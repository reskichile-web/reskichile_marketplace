import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reskichile.cl'

function buildEmailHtml(name: string | null, link: string): string {
  const displayName = name ? name.split(' ')[0] : 'te'
  return `<!DOCTYPE html>
<html>
<head>
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;line-height:1.6;">
<div style="max-width:520px;margin:0 auto;padding:32px 20px;">

  <p style="margin:0 0 6px 0;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:600;">ReskiChile</p>
  <h1 style="margin:0 0 20px 0;font-size:24px;font-weight:800;color:#111;">Tu cuenta está lista 🎿</h1>

  <p style="margin:0 0 14px 0;font-size:15px;color:#333;">
    Hola${name ? ` <strong>${displayName}</strong>` : ''}, te invitamos a configurar tu contraseña para acceder a ReskiChile.
  </p>
  <p style="margin:0 0 28px 0;font-size:15px;color:#333;">
    Haz click en el botón para elegir tu contraseña y entrar a tu cuenta:
  </p>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="background:#2563eb;border-radius:8px;">
        <a href="${link}"
           style="display:inline-block;padding:14px 28px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;border-radius:8px;">
          Configurar contraseña →
        </a>
      </td>
    </tr>
  </table>

  <p style="margin:24px 0 0 0;font-size:12px;color:#999;">
    Este link expira en 24 horas. Si no lo solicitaste, ignora este mensaje.
  </p>

  <hr style="border:none;border-top:1px solid #eee;margin:28px 0;">
  <div style="font-size:12px;color:#aaa;text-align:center;">
    <a href="${SITE_URL}" style="color:#aaa;text-decoration:none;">reskichile.cl</a>
    &nbsp;·&nbsp;
    <a href="https://instagram.com/reskichile" style="color:#aaa;text-decoration:none;">@reskichile</a>
  </div>
</div>
</body></html>`
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { userId, email, name } = await request.json()
  if (!userId || !email) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  // Generate Supabase recovery link (creates a magic link session)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${SITE_URL}/auth/reset-password`,
      expiresIn: 60 * 60 * 24 * 90, // 90 days
    },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('generateLink error:', linkError)
    return NextResponse.json({ error: 'No se pudo generar el link' }, { status: 500 })
  }

  const link = linkData.properties.action_link

  // Send email via Gmail
  const gmailPassword = process.env.GMAIL_APP_PASSWORD
  if (!gmailPassword) return NextResponse.json({ error: 'GMAIL_APP_PASSWORD no configurado' }, { status: 500 })

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: 'reskichile@gmail.com', pass: gmailPassword },
  })

  try {
    await transporter.sendMail({
      from: '"ReskiChile" <reskichile@gmail.com>',
      to: email,
      subject: 'Configura tu acceso a ReskiChile',
      html: buildEmailHtml(name, link),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ error: `Email error: ${msg}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, link })
}
