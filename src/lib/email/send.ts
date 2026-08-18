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
  /** Carbon copy — visible to all recipients. */
  cc?: string | string[]
  /** Blind copy — hidden from the `to` recipient. */
  bcc?: string | string[]
  /** Stable provider key used to make retries safe for 24 hours. */
  idempotencyKey?: string
}

export interface SendEmailResult {
  ok: boolean
  id?: string
  error?: string
  status?: number
  retryable?: boolean
  /** The request may have reached the provider but its response was lost. */
  uncertain?: boolean
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
        ...(input.idempotencyKey
          ? { 'Idempotency-Key': input.idempotencyKey }
          : {}),
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(input.cc ? { cc: input.cc } : {}),
        ...(input.bcc ? { bcc: input.bcc } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      // Resend returns { name, message } on error; surface message + status so
      // 429 (rate/quota) and domain-verification errors are visible in logs.
      const message = data?.message || `Resend respondió ${res.status}`
      const errorName = typeof data?.name === 'string' ? data.name : ''
      const retryable =
        res.status === 429 ||
        res.status >= 500 ||
        errorName === 'concurrent_idempotent_requests'
      return {
        ok: false,
        error: message,
        status: res.status,
        retryable,
        uncertain: false,
      }
    }

    return { ok: true, id: data?.id }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error de red al enviar correo',
      retryable: false,
      uncertain: true,
    }
  }
}
