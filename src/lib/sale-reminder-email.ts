import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/send'
import { buildSaleReminderEmail } from '@/lib/email/templates'
import { generateToken } from '@/lib/sold'

interface SellerEmail {
  email: string | null
  notify_reminders_email?: boolean | null
}

export interface SaleReminderProduct {
  id: string
  brand: string
  model: string | null
  price: number
  anon_contact: string | null
  sale_reminder_sent_at?: string | null
  product_images: { url: string; order: number }[] | null
  users: SellerEmail | SellerEmail[] | null
}

export type SaleReminderSendResult =
  | {
      ok: true
      recipient: string
      sentAt: string
      trackingUpdated: boolean
    }
  | {
      ok: false
      code:
        | 'REMINDERS_DISABLED'
        | 'NO_RECIPIENT'
        | 'TOKEN_CREATE_FAILED'
        | 'EMAIL_SEND_FAILED'
      error: string
    }

export interface SaleReminderSendOptions {
  /** Stable provider key for cron retries. */
  idempotencyKey?: string
  /** Stable links keep an idempotent retry byte-for-byte equivalent. */
  actionTokens?: {
    confirmSold: string
    stillAvailable: string
  }
  /** Reserved for an explicitly authorized, one-off service campaign. */
  ignoreReminderPreference?: boolean
}

function reminderSeller(product: SaleReminderProduct): SellerEmail | null {
  return Array.isArray(product.users)
    ? product.users[0] ?? null
    : product.users
}

function reminderRecipient(product: SaleReminderProduct): string | null {
  const seller = reminderSeller(product)
  const sellerEmail = seller?.email?.trim()
  const anonEmail = product.anon_contact?.includes('@')
    ? product.anon_contact.trim()
    : null
  return sellerEmail || anonEmail || null
}

/**
 * Sends the canonical "¿lo vendiste?" email for one product. Both the daily
 * cron and the manual admin action go through this function so the template,
 * action tokens, delivery provider, and reminder clock cannot drift apart.
 */
export async function sendSaleReminderForProduct(
  admin: SupabaseClient,
  product: SaleReminderProduct,
  options: SaleReminderSendOptions = {},
): Promise<SaleReminderSendResult> {
  if (
    !options.ignoreReminderPreference
    && reminderSeller(product)?.notify_reminders_email === false
  ) {
    return {
      ok: false,
      code: 'REMINDERS_DISABLED',
      error: 'El vendedor desactivó los correos de recordatorio',
    }
  }

  const recipient = reminderRecipient(product)
  if (!recipient) {
    return {
      ok: false,
      code: 'NO_RECIPIENT',
      error: 'El vendedor no tiene un correo disponible',
    }
  }

  const confirmToken = options.actionTokens?.confirmSold || generateToken()
  const availableToken = options.actionTokens?.stillAvailable || generateToken()
  const tokenRows = [
    { token: confirmToken, product_id: product.id, action: 'confirm_sold' },
    { token: availableToken, product_id: product.id, action: 'still_available' },
  ]
  const tokenWrite = admin.from('product_action_tokens')
  const { error: tokenError } = options.actionTokens
    ? await tokenWrite.upsert(tokenRows, {
        onConflict: 'token',
        ignoreDuplicates: true,
      })
    : await tokenWrite.insert(tokenRows)
  if (tokenError) {
    return {
      ok: false,
      code: 'TOKEN_CREATE_FAILED',
      error: 'No pudimos crear los enlaces de respuesta',
    }
  }

  const images = product.product_images ?? []
  const imageUrl = images.slice().sort((a, b) => a.order - b.order)[0]?.url ?? null
  const { subject, html, text } = buildSaleReminderEmail({
    brand: product.brand,
    model: product.model,
    price: product.price,
    imageUrl,
    soldPath: `/p/vendi/${confirmToken}?alt=${availableToken}`,
    availablePath: `/p/disponible/${availableToken}?alt=${confirmToken}`,
  })

  const delivery = await sendEmail({
    to: recipient,
    subject,
    html,
    text,
    ...(options.idempotencyKey
      ? { idempotencyKey: options.idempotencyKey }
      : {}),
  })
  if (!delivery.ok) {
    return {
      ok: false,
      code: 'EMAIL_SEND_FAILED',
      error: delivery.error || 'No pudimos enviar el correo',
    }
  }

  const sentAt = new Date().toISOString()
  const { error: trackingError } = await admin
    .from('products')
    .update({ sale_reminder_sent_at: sentAt })
    .eq('id', product.id)

  return {
    ok: true,
    recipient,
    sentAt,
    trackingUpdated: !trackingError,
  }
}
