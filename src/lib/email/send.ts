// Single choke point for all app-sent email. Talks to the Resend REST API
// directly via fetch (no SDK dependency). Every automated sender goes through
// here so auth, error handling, and the from-address live in one place.
//
// Env:
//   RESEND_API_KEY   — required (already in .env.local)
//   EMAIL_FROM       — optional override. Defaults to the same verified sender
//                      Supabase Auth already uses (noreply@reskichile.cl, root
//                      domain verified in Resend), so this works in localhost
//                      and production with no extra config.

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

const DEFAULT_FROM = 'ReSkiChile <noreply@reskichile.cl>'

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  /** Blind copy — hidden from the `to` recipient. */
  bcc?: string | string[]
}

export interface SendEmailResult {
  ok: boolean
  id?: string
  error?: string
}

/**
 * Send one email through Resend. Never throws — returns { ok:false, error }
 * on failure so callers can decide whether the surrounding flow should care.
 * Automated notifications should treat a failed send as non-fatal.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY no configurado' }
  }

  const from = process.env.EMAIL_FROM || DEFAULT_FROM

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(input.bcc ? { bcc: input.bcc } : {}),
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      // Resend returns { name, message } on error; surface message + status so
      // 429 (rate/quota) and domain-verification errors are visible in logs.
      const message = data?.message || `Resend respondió ${res.status}`
      return { ok: false, error: message }
    }

    return { ok: true, id: data?.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error de red al enviar correo' }
  }
}
