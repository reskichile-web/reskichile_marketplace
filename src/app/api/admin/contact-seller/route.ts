import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const LOGO_URL = 'https://reskichile.cl/logo.svg'

function bodyToHtml(body: string, productImageUrl?: string): string {
  const escaped = escapeHtml(body)
  const withBold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const paragraphs = withBold
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 14px 0;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')

  // Two-column body when a product image is supplied. Falls back to a
  // single column otherwise (used by the generic "invite to ReskiChile" flow).
  const bodyInner = productImageUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td valign="top" style="padding-right:18px;font-size:15px;">${paragraphs}</td>
          <td valign="top" width="160" style="width:160px;">
            <img src="${escapeHtml(productImageUrl)}" alt="" width="160"
              style="display:block;width:160px;height:auto;border-radius:8px;border:0;outline:none;text-decoration:none;" />
          </td>
        </tr>
      </table>`
    : `<div style="font-size:15px;">${paragraphs}</div>`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
  /* Force footer celeste even in dark mode (Gmail / Apple / Outlook.com) */
  .reski-footer { background-color:#7eb1e1 !important; }
  .reski-footer a, .reski-footer span { color:#ffffff !important; }
  [data-ogsc] .reski-footer { background-color:#7eb1e1 !important; }
  [data-ogsc] .reski-footer a, [data-ogsc] .reski-footer span { color:#ffffff !important; }
  @media (prefers-color-scheme: dark) {
    .reski-footer { background-color:#7eb1e1 !important; }
    .reski-footer a, .reski-footer span { color:#ffffff !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.55;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
  <!-- Header band with logo -->
  <tr>
    <td style="padding:14px 20px;border-bottom:1px solid #eef2f7;text-align:left;">
      <a href="https://reskichile.cl" style="text-decoration:none;">
        <img src="${LOGO_URL}" alt="ReskiChile" height="28"
          style="display:inline-block;height:28px;width:auto;border:0;outline:none;text-decoration:none;" />
      </a>
    </td>
  </tr>
  <!-- Body: adapts to theme -->
  <tr>
    <td style="padding:32px 20px;">
      <div style="max-width:620px;margin:0 auto;">
        ${bodyInner}
      </div>
    </td>
  </tr>
  <!-- Footer band: brand celeste, full width, pegado abajo -->
  <tr>
    <td class="reski-footer" bgcolor="#7eb1e1" style="background-color:#7eb1e1;padding:18px 20px;text-align:center;font-size:13px;">
      <a href="https://reskichile.cl" style="color:#ffffff !important;text-decoration:none;font-weight:600;">reskichile.cl</a>
      <span style="color:#ffffff !important;">&nbsp;·&nbsp;</span>
      <a href="https://instagram.com/reskichile" style="color:#ffffff !important;text-decoration:none;font-weight:600;">@reskichile</a>
    </td>
  </tr>
</table>
</body></html>`
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { to, subject, body, productImageUrl } = await request.json()

  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
  }

  const password = process.env.GMAIL_APP_PASSWORD
  if (!password) {
    return NextResponse.json({ error: 'GMAIL_APP_PASSWORD no configurado en .env.local' }, { status: 500 })
  }

  const html = bodyToHtml(body, typeof productImageUrl === 'string' ? productImageUrl : undefined)

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'reskichile@gmail.com',
      pass: password,
    },
  })

  try {
    await transporter.sendMail({
      from: '"ReSkiChile" <reskichile@gmail.com>',
      to,
      subject,
      text: body,
      html,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
