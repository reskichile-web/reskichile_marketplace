// Shared HTML email chrome + the automated templates. All ReSkiChile mail
// shares the celeste header (white logo) + celeste footer, dark-mode safe.
import { OWNER_WHATSAPP } from '@/lib/owner'
import { CONDITIONS, PRODUCT_TYPES } from '@/lib/constants'

// PNG hosted on the Supabase public bucket — Gmail/Outlook don't render SVG,
// and the bucket URL is live without waiting for a site deploy.
const LOGO_URL =
  'https://kdehuccekavwhhuvvogf.supabase.co/storage/v1/object/public/product-images/email/reski-logo-white.png'
const WHATSAPP_ICON =
  'https://kdehuccekavwhhuvvogf.supabase.co/storage/v1/object/public/product-images/email/whatsapp.png'
const MAIL_ICON =
  'https://kdehuccekavwhhuvvogf.supabase.co/storage/v1/object/public/product-images/email/mail.png'
// White checkmark with square caps — same glyph as the app's success overlay
// (AuthLoadingOverlay path "M5 13l4 4L19 7"). PNG so the straight edges render
// identically everywhere (the unicode ✓ is curvy and varies by client).
const CHECK_ICON =
  'https://kdehuccekavwhhuvvogf.supabase.co/storage/v1/object/public/product-images/email/check-white.png'
// Transactional marketplace emails always send users to the public site.
// APP_URL is deployment-specific (for example, the Webpay sandbox preview),
// so it must never determine links delivered to real users.
const SITE_URL = 'https://www.reskichile.cl'
const SUPPORT_EMAIL = 'reskichile@gmail.com'
const BRAND = '#2674c0' // azul ReSkiChile para los correos

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function layout(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!-- Force light: never let the client invert to dark mode -->
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>
  :root { color-scheme: only light; supported-color-schemes: only light; }
  body, .reski-wrap, .reski-body { background-color:#ffffff !important; }
  /* Product card uses a fluid hybrid layout: it stacks by default (so the CTA
     is never clipped in clients that ignore media queries — Gmail app, Outlook),
     and this query only upgrades the stacked image to full-bleed where supported. */
  @media (max-width:480px) {
    .pc-img { max-width:100% !important; height:auto !important;
              border-radius:12px 12px 0 0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.55;">
<table role="presentation" class="reski-wrap" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#ffffff" style="border-collapse:collapse;background-color:#ffffff;">
  <!-- Header band: celeste with centered white logo -->
  <tr>
    <td bgcolor="${BRAND}" style="background-color:${BRAND};padding:24px 20px;text-align:center;">
      <a href="${SITE_URL}" style="text-decoration:none;">
        <img src="${LOGO_URL}" alt="ReSkiChile" height="42"
          style="display:inline-block;height:42px;width:auto;border:0;outline:none;text-decoration:none;" />
      </a>
    </td>
  </tr>
  <tr>
    <td class="reski-body" bgcolor="#ffffff" style="background-color:#ffffff;padding:32px 20px;">
      <div style="max-width:620px;margin:0 auto;font-size:15px;color:#1f2937;">
        ${bodyHtml}
      </div>
    </td>
  </tr>
  <!-- Footer band -->
  <tr>
    <td bgcolor="${BRAND}" style="background-color:${BRAND};padding:18px 20px;text-align:center;font-size:13px;">
      <a href="${SITE_URL}" style="color:#ffffff;text-decoration:none;font-weight:600;">reskichile.cl</a>
      <span style="color:#ffffff;">&nbsp;·&nbsp;</span>
      <a href="https://instagram.com/reskichile" style="color:#ffffff;text-decoration:none;font-weight:600;">@reskichile</a>
    </td>
  </tr>
</table>
</body></html>`
}

/** Primary celeste button. */
function formatCLP(n: number): string {
  return '$' + n.toLocaleString('es-CL')
}

/** Success tick matching the app's success overlay exactly: a green-500
 *  (#22c55e) circle with the white square-edged checkmark (CHECK_ICON). The
 *  circle is a <td bgcolor> so it survives clients that strip backgrounds, and
 *  the check is a transparent PNG centered inside it. */
function successTick(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="margin:0;">
    <tr>
      <td width="38" height="38" align="center" valign="middle" bgcolor="#22c55e"
        style="width:38px;height:38px;background-color:#22c55e;border-radius:50%;text-align:center;">
        <img src="${CHECK_ICON}" width="22" height="22" alt="✓" style="display:block;margin:0 auto;border:0;" />
      </td>
    </tr>
  </table>`
}

/** Responsive product card via fluid hybrid (see imgCol comment below). Desktop:
 *  image left, details right; narrow screens stack with no media-query reliance.
 *  The success tick sits top-right of the details column on every width. */
function productCard(p: ApprovedProduct): string {
  const title = productTitle(p.brand, p.model)
  const url = `${SITE_URL}${p.path}`
  const detail = [CONDITIONS[p.condition], PRODUCT_TYPES[p.productType]].filter(Boolean).join(' · ')
  // Full-width block button — reliable across all clients, no media query needed.
  const cta = `<a href="${url}" style="display:block;width:100%;box-sizing:border-box;padding:14px 0;font-size:13px;font-weight:700;letter-spacing:0.02em;color:#ffffff;background-color:${BRAND};text-decoration:none;text-align:center;">VER PRODUCTO</a>`

  // Fluid hybrid: the image + body are inline-block columns that sit side by side
  // when there's room (desktop) and wrap to stacked when the screen is narrow —
  // WITHOUT relying on media-query support. The MSO comments give Outlook a real
  // two-cell table since it ignores inline-block. Outer font-size:0 kills the gap.
  const imgCol = p.imageUrl
    ? `<!--[if mso]><td width="170" valign="top"><![endif]-->
       <div style="display:inline-block;vertical-align:top;width:100%;max-width:170px;font-size:0;line-height:0;">
         <img class="pc-img" src="${escapeHtml(p.imageUrl)}" width="170" alt="${escapeHtml(title)}"
           style="display:block;width:100%;max-width:170px;height:170px;object-fit:cover;border:0;outline:none;text-decoration:none;" />
       </div>
       <!--[if mso]></td><td valign="top"><![endif]-->`
    : '<!--[if mso]><td valign="top"><![endif]-->'

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
    style="border-collapse:separate;border:1px solid #eef2f7;border-radius:12px;overflow:hidden;margin:6px 0 12px;">
    <tr>
      <td style="padding:0;font-size:0;">
        <!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><![endif]-->
        ${imgCol}
        <div style="display:inline-block;vertical-align:top;width:100%;max-width:430px;">
          <div style="padding:18px 20px;font-size:15px;line-height:1.5;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td valign="top" style="padding:0;">
                  <p style="margin:0 0 5px;font-size:16px;font-weight:700;color:#1f2937;">${escapeHtml(title)}</p>
                  <p style="margin:0;font-size:19px;font-weight:800;color:${BRAND};">${formatCLP(p.price)}</p>
                </td>
                <td valign="top" align="right" width="36" style="padding:0 0 0 10px;">${successTick()}</td>
              </tr>
            </table>
            ${detail ? `<p style="margin:8px 0 14px;font-size:13px;color:#6b7280;">${escapeHtml(detail)}</p>` : '<div style="height:14px;"></div>'}
            ${cta}
          </div>
        </div>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>`
}

/** Small, light "¿Tienes alguna duda?" block with WhatsApp + email buttons.
 *  The WhatsApp link is a wa.me button so the number is never shown as text. */
function contactBlock(): string {
  const waMsg = encodeURIComponent('Hola, tengo una consulta sobre ReSkiChile.')
  const waUrl = `https://wa.me/${OWNER_WHATSAPP}?text=${waMsg}`
  const mailUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Consulta — ReSkiChile')}`
  // Bulletproof button: the fill colour lives on the <td bgcolor>, not the <a>,
  // so clients that strip backgrounds off inline links (Gmail/Apple Mail) keep
  // the green — otherwise the white WhatsApp glyph would vanish on white.
  const link = 'display:inline-block;font-size:12px;font-weight:600;text-decoration:none;padding:9px 16px;'
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-top:26px;">
    <tr><td align="center" style="padding-top:16px;border-top:1px solid #eef2f7;text-align:center;">
      <p style="margin:0 0 11px 0;font-size:13px;color:#9ca3af;">¿Tienes alguna duda?</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block;vertical-align:middle;margin:0 4px;">
        <tr><td bgcolor="#25D366" style="background-color:#25D366;">
          <a href="${waUrl}" style="${link}color:#ffffff;"><img src="${WHATSAPP_ICON}" width="14" height="14" alt="" style="vertical-align:-2px;margin-right:6px;border:0;" />WhatsApp</a>
        </td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block;vertical-align:middle;margin:0 4px;">
        <tr><td bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #e5e7eb;">
          <a href="${mailUrl}" style="${link}color:#6b7280;"><img src="${MAIL_ICON}" width="15" height="15" alt="" style="vertical-align:-3px;margin-right:6px;border:0;" />Escríbenos</a>
        </td></tr>
      </table>
    </td></tr>
  </table>`
}

/** Display title for a product, e.g. "Rossignol Experience 88". */
export function productTitle(brand: string, model: string | null): string {
  return [brand, model].filter(Boolean).join(' ').trim() || 'tu producto'
}

function greeting(name: string | null): string {
  const who = name ? `¡Hola ${escapeHtml(name)}!` : '¡Hola!'
  return `<strong>${who}</strong>`
}

// ─── Template: producto en revisión ──────────────────────────────────────────

export interface BuiltEmail {
  subject: string
  html: string
  text: string
}

export function buildReviewEmail(name: string | null, brand: string, model: string | null): BuiltEmail {
  const title = productTitle(brand, model)
  const url = `${SITE_URL}/mis-productos`
  const subject = 'Tu producto entró en revisión'
  const html = layout(`
    <p style="margin:0 0 14px 0;color:#1f2937;">${greeting(name)}</p>
    <p style="margin:0 0 14px 0;color:#1f2937;">Recibimos tu publicación de <strong>${escapeHtml(title)}</strong> y ya entró en revisión. Nuestro equipo la revisará pronto y te avisaremos apenas esté aprobada y visible en el catálogo. Puedes revisar el estado de tu producto <a href="${url}" style="color:${BRAND};font-weight:600;text-decoration:underline;">aquí</a>.</p>
    <p style="margin:0 0 14px 0;color:#1f2937;">Gracias por vender en ReSkiChile. ❄️</p>
    ${contactBlock()}
  `)
  const text = `${name ? `Hola ${name},` : 'Hola,'}\n\nRecibimos tu publicación de ${title} y ya entró en revisión. Te avisaremos apenas esté aprobada y visible en el catálogo.\n\nRevisa el estado de tu producto aquí: ${url}\n\n¿Dudas? WhatsApp: https://wa.me/${OWNER_WHATSAPP} · Correo: ${SUPPORT_EMAIL}\n\nGracias por vender en ReSkiChile.`
  return { subject, html, text }
}

// ─── Template: producto aprobado ─────────────────────────────────────────────

export interface ApprovedProduct {
  brand: string
  model: string | null
  price: number
  condition: string
  productType: string
  imageUrl: string | null
  path: string
}

export function buildApprovedEmail(name: string | null, p: ApprovedProduct): BuiltEmail {
  const title = productTitle(p.brand, p.model)
  const url = `${SITE_URL}${p.path}`
  const subject = '¡Tu producto fue aprobado!'
  const html = layout(`
    <p style="margin:0 0 14px 0;color:#1f2937;">${greeting(name)}</p>
    <p style="margin:0 0 20px 0;color:#1f2937;">¡Buenas noticias! Tu publicación fue aprobada y ya está visible en el catálogo de ReSkiChile. Revisa tu producto <a href="${url}" style="color:${BRAND};font-weight:600;text-decoration:underline;">aquí</a>.</p>
    ${productCard(p)}
    ${contactBlock()}
  `)
  const text = `${name ? `Hola ${name},` : 'Hola,'}\n\nTu publicación de ${title} (${formatCLP(p.price)}) fue aprobada y ya está visible en el catálogo.\n\nRevisa tu producto aquí: ${url}\n\n¿Dudas? WhatsApp: https://wa.me/${OWNER_WHATSAPP} · Correo: ${SUPPORT_EMAIL}\n\nReSkiChile`
  return { subject, html, text }
}

// ─── Template: nuevo mensaje de chat ────────────────────────────────────────

export interface ChatMessageEmail {
  conversationId: string
  senderName: string | null
  recipientName: string | null
  messageBody: string
  productTitle: string | null
  productImageUrl: string | null
}

function messagePreview(body: string): string {
  const cleaned = body.replace(/\s+/g, ' ').trim()
  return cleaned.length > 220 ? `${cleaned.slice(0, 217)}...` : cleaned
}

function chatBubble(p: ChatMessageEmail): string {
  const sender = p.senderName?.trim() || 'Usuario de ReSkiChile'
  const product = p.productTitle?.trim()
  const body = escapeHtml(messagePreview(p.messageBody)).replace(/\n/g, '<br>')
  const productLine = product
    ? `<p style="margin:0 0 10px;font-size:13px;color:#6b7280;">Sobre <strong style="color:#374151;">${escapeHtml(product)}</strong></p>`
    : ''
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
    style="border-collapse:separate;border:1px solid #e5edf6;border-radius:14px;background-color:#f8fbff;margin:18px 0 18px;">
    <tr>
      <td style="padding:18px 18px 16px;">
        ${productLine}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td width="46" valign="top" style="padding:0 12px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="46" height="46" bgcolor="#eef2f7" style="border-collapse:separate;background-color:#eef2f7;border-radius:50%;">
                <tr>
                  <td width="46" height="46" align="center" valign="middle" style="width:46px;height:46px;text-align:center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;margin:0 auto;">
                      <tr>
                        <td align="center" style="padding:8px 0 2px;">
                          <span style="display:block;width:13px;height:13px;background-color:#94a3b8;border-radius:50%;font-size:0;line-height:0;">&nbsp;</span>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:1px 0 0;">
                          <span style="display:block;width:24px;height:12px;background-color:#94a3b8;border-radius:12px 12px 6px 6px;font-size:0;line-height:0;">&nbsp;</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
            <td valign="top" align="left" style="padding:0;text-align:left;">
              <p style="margin:0 0 7px;font-size:13px;font-weight:700;color:${BRAND};text-align:left;">${escapeHtml(sender)}</p>
              <div style="display:inline-block;max-width:100%;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:0 14px 14px 14px;padding:12px 14px;font-size:15px;line-height:1.5;color:#1f2937;text-align:left;">
                ${body}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`
}

export function buildChatMessageEmail(p: ChatMessageEmail): BuiltEmail {
  const sender = p.senderName?.trim() || 'Alguien'
  const url = `${SITE_URL}/mensajes/${p.conversationId}`
  const subject = p.productTitle
    ? `${sender} te escribió por ${p.productTitle}`
    : `${sender} te envió un mensaje`
  const html = layout(`
    <p style="margin:0 0 14px 0;color:#1f2937;">${greeting(p.recipientName)}</p>
    <p style="margin:0 0 14px 0;color:#1f2937;">Tienes un nuevo mensaje en ReSkiChile.</p>
    ${chatBubble(p)}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;margin:20px auto 0;">
      <tr>
        <td align="center" bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid ${BRAND};">
          <a href="${url}" style="display:inline-block;padding:13px 30px;font-size:13px;font-weight:700;letter-spacing:0.02em;color:${BRAND};text-decoration:none;text-align:center;">RESPONDER MENSAJE</a>
        </td>
      </tr>
    </table>
    ${contactBlock()}
  `)
  const text = `${p.recipientName ? `Hola ${p.recipientName},` : 'Hola,'}\n\n${sender} te envió un mensaje${p.productTitle ? ` sobre ${p.productTitle}` : ''}:\n\n"${messagePreview(p.messageBody)}"\n\nRespóndelo aquí: ${url}\n\nReSkiChile`
  return { subject, html, text }
}

// ─── Helpers: CTA buttons (primary celeste / outline) ────────────────────────

function ctaOutline(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;margin:8px auto;">
    <tr><td align="center" bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #d1d5db;">
      <a href="${url}" style="display:inline-block;padding:12px 28px;font-size:13px;font-weight:700;letter-spacing:0.02em;color:#6b7280;text-decoration:none;text-align:center;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`
}

/** Two equal-width buttons side by side (primary celeste + outline). Fixed cell
 *  widths so both render the same size across clients. */
function ctaTwoUp(primaryUrl: string, primaryLabel: string, outlineUrl: string, outlineLabel: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;margin:10px auto 4px;">
    <tr>
      <td style="padding:0 5px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr><td align="center" bgcolor="${BRAND}" width="150" style="width:150px;background-color:${BRAND};">
            <a href="${primaryUrl}" style="display:block;padding:14px 8px;font-size:12px;font-weight:700;letter-spacing:0.02em;color:#ffffff;text-decoration:none;text-align:center;">${escapeHtml(primaryLabel)}</a>
          </td></tr>
        </table>
      </td>
      <td style="padding:0 5px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr><td align="center" bgcolor="#ffffff" width="150" style="width:150px;background-color:#ffffff;border:1px solid #d1d5db;">
            <a href="${outlineUrl}" style="display:block;padding:13px 8px;font-size:12px;font-weight:700;letter-spacing:0.02em;color:#6b7280;text-decoration:none;text-align:center;">${escapeHtml(outlineLabel)}</a>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>`
}

// ─── Template: venta registrada (al vendedor, BCC equipo) ────────────────────

export interface SaleEmail {
  name: string | null
  brand: string
  model: string | null
  listedPrice: number
  salePrice: number | null
  channelLabel: string | null
  speedLabel: string | null
  imageUrl: string | null
  productPath: string
  undoPath: string   // /p/venta/deshacer/[token]
}

export function buildSaleEmail(p: SaleEmail): BuiltEmail {
  const title = productTitle(p.brand, p.model)
  const undoUrl = `${SITE_URL}${p.undoPath}`
  const subject = `¡Felicitaciones por tu venta! · ${title}`

  const detailRows: string[] = []
  detailRows.push(`<tr><td style="padding:4px 0;font-size:14px;color:#6b7280;">Publicado en</td><td style="padding:4px 0;font-size:14px;color:#1f2937;text-align:right;font-weight:600;">${formatCLP(p.listedPrice)}</td></tr>`)
  if (p.salePrice != null) {
    detailRows.push(`<tr><td style="padding:4px 0;font-size:14px;color:#6b7280;">Vendido en</td><td style="padding:4px 0;font-size:14px;color:${BRAND};text-align:right;font-weight:800;">${formatCLP(p.salePrice)}</td></tr>`)
  }
  if (p.channelLabel) {
    detailRows.push(`<tr><td style="padding:4px 0;font-size:14px;color:#6b7280;">Canal</td><td style="padding:4px 0;font-size:14px;color:#1f2937;text-align:right;">${escapeHtml(p.channelLabel)}</td></tr>`)
  }
  if (p.speedLabel) {
    detailRows.push(`<tr><td style="padding:4px 0;font-size:14px;color:#6b7280;">Venta</td><td style="padding:4px 0;font-size:14px;color:#1f2937;text-align:right;">${escapeHtml(p.speedLabel)}</td></tr>`)
  }

  const imgBlock = p.imageUrl
    ? `<img src="${escapeHtml(p.imageUrl)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:cover;border-radius:10px;border:0;" />`
    : ''

  const html = layout(`
    <p style="margin:0 0 14px 0;color:#1f2937;">${greeting(p.name)}</p>
    <p style="margin:0 0 18px 0;color:#1f2937;">Registramos la venta de <strong>${escapeHtml(title)}</strong>. ¡Felicitaciones y gracias por vender en ReSkiChile! 🎉</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border:1px solid #eef2f7;border-radius:12px;margin:0 0 20px;">
      <tr>
        <td valign="top" width="64" style="padding:16px 0 16px 16px;">${imgBlock}</td>
        <td valign="top" style="padding:16px 16px 16px 14px;">
          <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#1f2937;">${escapeHtml(title)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">${detailRows.join('')}</table>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 6px 0;font-size:13px;color:#9ca3af;text-align:center;">¿Te equivocaste? Puedes deshacer la venta y volver a publicarlo:</p>
    ${ctaOutline(undoUrl, 'Deshacer venta')}
    ${contactBlock()}
  `)

  const lines = [
    p.name ? `Hola ${p.name},` : 'Hola,',
    '',
    `Registramos la venta de ${title}. ¡Felicitaciones!`,
    `Publicado en: ${formatCLP(p.listedPrice)}`,
    p.salePrice != null ? `Vendido en: ${formatCLP(p.salePrice)}` : '',
    p.channelLabel ? `Canal: ${p.channelLabel}` : '',
    p.speedLabel ? `Venta: ${p.speedLabel}` : '',
    '',
    `¿Te equivocaste? Deshacer la venta: ${undoUrl}`,
    '',
    'ReSkiChile',
  ].filter(Boolean)
  return { subject, html, text: lines.join('\n') }
}

// ─── Template: recordatorio 30 días "¿lo vendiste?" ──────────────────────────

export interface SaleReminderEmail {
  brand: string
  model: string | null
  price: number
  imageUrl: string | null
  soldPath: string        // /p/vendi/[token]
  availablePath: string   // /p/disponible/[token]
}

export function buildSaleReminderEmail(p: SaleReminderEmail): BuiltEmail {
  const title = productTitle(p.brand, p.model)
  const soldUrl = `${SITE_URL}${p.soldPath}`
  const availUrl = `${SITE_URL}${p.availablePath}`
  const subject = `¿Vendiste tu ${title}?`

  const imgBlock = p.imageUrl
    ? `<img src="${escapeHtml(p.imageUrl)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:cover;border-radius:10px;border:0;" />`
    : ''

  const html = layout(`
    <p style="margin:0 0 14px 0;color:#1f2937;"><strong>¡Hola!</strong></p>
    <p style="margin:0 0 18px 0;color:#1f2937;">Tu publicación de <strong>${escapeHtml(title)}</strong> sigue en ReSkiChile. ¿Ya la vendiste? Cuéntanos con un toque:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border:1px solid #eef2f7;border-radius:12px;margin:0 0 22px;">
      <tr>
        <td valign="top" width="64" style="padding:16px 0 16px 16px;">${imgBlock}</td>
        <td valign="middle" style="padding:16px 16px 16px 14px;">
          <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#1f2937;">${escapeHtml(title)}</p>
          <p style="margin:0;font-size:15px;font-weight:800;color:${BRAND};">${formatCLP(p.price)}</p>
        </td>
      </tr>
    </table>
    ${ctaTwoUp(soldUrl, 'Sí, ya la vendí', availUrl, 'No, sigue disponible')}
    ${contactBlock()}
  `)

  const text = `Hola,\n\nTu publicación de ${title} sigue en ReSkiChile. ¿Ya la vendiste?\n\nSí, ya la vendí: ${soldUrl}\nNo, sigue disponible: ${availUrl}\n\nReSkiChile`
  return { subject, html, text }
}

// ─── Template: aviso interno simple (al equipo) ──────────────────────────────

export function buildInternalNotice(title: string, rows: { label: string; value: string }[]): BuiltEmail {
  const body = rows
    .map(r => `<tr><td style="padding:5px 0;font-size:14px;color:#6b7280;">${escapeHtml(r.label)}</td><td style="padding:5px 0;font-size:14px;color:#1f2937;text-align:right;font-weight:600;">${escapeHtml(r.value)}</td></tr>`)
    .join('')
  const html = layout(`
    <p style="margin:0 0 16px 0;font-size:17px;font-weight:800;color:#1f2937;">${escapeHtml(title)}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">${body}</table>
  `)
  const text = `${title}\n\n${rows.map(r => `${r.label}: ${r.value}`).join('\n')}`
  return { subject: title, html, text }
}

// ─── Templates: comercio / Webpay ──────────────────────────────────────────

export interface CommerceEmailItem {
  name: string
  quantity: number
  lineTotalClp: number
}

export interface OrderConfirmationEmail {
  buyerName: string
  orderNumber: string
  orderPublicId: string
  deliveryMethod: 'home' | 'pickup'
  destinationRegion: string
  destinationCommune: string
  subtotalClp: number
  discountClp: number
  shippingClp: number
  totalClp: number
  items: CommerceEmailItem[]
}

export function buildOrderConfirmationEmail(
  order: OrderConfirmationEmail
): BuiltEmail {
  const resultUrl = `${SITE_URL}/checkout/resultado?orden=${encodeURIComponent(order.orderPublicId)}`
  const itemRows = order.items.map(item => `
    <tr>
      <td style="padding:7px 0;font-size:14px;color:#374151;">${escapeHtml(item.name)} × ${item.quantity}</td>
      <td style="padding:7px 0;font-size:14px;color:#111827;text-align:right;font-weight:600;">${formatCLP(item.lineTotalClp)}</td>
    </tr>`).join('')
  const discountRow = order.discountClp > 0
    ? `<tr><td style="padding:7px 0;font-size:14px;color:#059669;">Descuento</td><td style="padding:7px 0;font-size:14px;color:#059669;text-align:right;">-${formatCLP(order.discountClp)}</td></tr>`
    : ''
  const deliveryLabel = order.deliveryMethod === 'pickup'
    ? 'Sucursal o punto de retiro'
    : 'Despacho a domicilio'
  const subject = `Compra confirmada · ${order.orderNumber}`
  const html = layout(`
    <p style="margin:0 0 14px;color:#1f2937;">${greeting(order.buyerName)}</p>
    <p style="margin:0 0 18px;color:#1f2937;">Recibimos tu pago. Tu orden <strong>${escapeHtml(order.orderNumber)}</strong> ya entró a preparación.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
      ${itemRows}
      ${discountRow}
      <tr><td style="padding:7px 0;font-size:14px;color:#6b7280;">Despacho</td><td style="padding:7px 0;font-size:14px;color:#111827;text-align:right;">${formatCLP(order.shippingClp)}</td></tr>
      <tr><td style="padding:12px 0 8px;font-size:16px;color:#111827;font-weight:800;">Total</td><td style="padding:12px 0 8px;font-size:16px;color:#111827;text-align:right;font-weight:800;">${formatCLP(order.totalClp)}</td></tr>
    </table>
    <p style="margin:18px 0 4px;color:#374151;font-weight:700;">${deliveryLabel}</p>
    <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">${escapeHtml(order.destinationCommune)}, ${escapeHtml(order.destinationRegion)}</p>
    ${ctaOutline(resultUrl, 'Ver estado de la orden')}
    <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#9ca3af;text-align:center;">ReskiChile nunca recibe ni almacena los datos de tu tarjeta.</p>
    ${contactBlock()}
  `)
  const textItems = order.items
    .map(item => `- ${item.name} × ${item.quantity}: ${formatCLP(item.lineTotalClp)}`)
    .join('\n')
  const text = `Hola ${order.buyerName},\n\nRecibimos tu pago. Tu orden ${order.orderNumber} ya entró a preparación.\n\n${textItems}\nDespacho: ${formatCLP(order.shippingClp)}\nTotal: ${formatCLP(order.totalClp)}\n\nEntrega: ${deliveryLabel}, ${order.destinationCommune}, ${order.destinationRegion}\n\nVer estado: ${resultUrl}\n\nReSkiChile`
  return { subject, html, text }
}
