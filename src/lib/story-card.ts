import { PRODUCT_TYPES, PRODUCT_ATTRIBUTES, CONDITIONS } from '@/lib/constants'
import type { ProductWithImages } from '@/lib/types'

const W = 1080
const H = 1920

// Image width matches mobile detail: 760, centered. Left margin (160) is
// reused as the alignment anchor for all left-aligned text.
const IMG_SIZE = 760
const LEFT = (W - IMG_SIZE) / 2

const BRAND = '#2674bf'
const BG_TOP = '#edf4fb'
const BG_BOTTOM = '#ffffff'
const TEXT = '#0f172a'
const TEXT_MUTED = '#64748b'
const TEXT_SOFT = '#94a3b8'

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

export async function generateStoryCard(product: ProductWithImages): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, BG_TOP)
  grad.addColorStop(1, BG_BOTTOM)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Brand logo (SVG → canvas)
  const logoW = 380
  const logoY = 170
  let logoH = 152
  try {
    const logo = await loadImage('/logo.svg')
    logoH = (logo.height / logo.width) * logoW
    ctx.drawImage(logo, (W - logoW) / 2, logoY, logoW, logoH)
  } catch {
    ctx.fillStyle = BRAND
    ctx.textAlign = 'center'
    ctx.font = `900 80px ${FONT_STACK}`
    ctx.fillText('ReskiChile', W / 2, logoY + 80)
  }

  // Product image card
  const imgY = logoY + logoH + 30

  ctx.save()
  ctx.shadowColor = 'rgba(15, 23, 42, 0.15)'
  ctx.shadowBlur = 32
  ctx.shadowOffsetY = 12
  ctx.fillStyle = '#ffffff'
  roundRectPath(ctx, LEFT, imgY, IMG_SIZE, IMG_SIZE, 32)
  ctx.fill()
  ctx.restore()

  const imageUrl = product.product_images
    ?.slice()
    .sort((a, b) => a.order - b.order)[0]?.url

  if (imageUrl) {
    try {
      const img = await loadImage(imageUrl)
      ctx.save()
      roundRectPath(ctx, LEFT, imgY, IMG_SIZE, IMG_SIZE, 32)
      ctx.clip()
      drawCover(ctx, img, LEFT, imgY, IMG_SIZE, IMG_SIZE)
      ctx.restore()
    } catch {
      ctx.save()
      roundRectPath(ctx, LEFT, imgY, IMG_SIZE, IMG_SIZE, 32)
      ctx.clip()
      ctx.fillStyle = '#eef4fb'
      ctx.fillRect(LEFT, imgY, IMG_SIZE, IMG_SIZE)
      ctx.restore()
    }
  }

  // Text block
  const title = [product.brand, product.model].filter(Boolean).join(' ') || 'Producto'
  const typeLabel = PRODUCT_TYPES[product.product_type] || product.product_type
  const price = `$${product.price.toLocaleString('es-CL')}`
  const conditionLabel = CONDITIONS[product.condition] || product.condition
  const seasons = product.seasons_used
  const location = `${product.region}${product.comuna ? ', ' + product.comuna : ''}`

  let y = imgY + IMG_SIZE + 60

  // Type label — CENTERED
  ctx.textAlign = 'center'
  ctx.fillStyle = BRAND
  ctx.font = `600 30px ${FONT_STACK}`
  ctx.fillText(typeLabel, W / 2, y)
  y += 60

  // Title — CENTERED
  ctx.fillStyle = TEXT
  ctx.font = `900 64px ${FONT_STACK}`
  drawTextEllipsized(ctx, title, W / 2, y, W - 120)
  y += 76

  // Everything below: LEFT-aligned, anchored at LEFT (image left edge)
  ctx.textAlign = 'left'

  // Price — LEFT
  ctx.fillStyle = BRAND
  ctx.font = `600 60px ${FONT_STACK}`
  ctx.fillText(price, LEFT, y)
  y += 50

  // Condition + seasons — LEFT
  const seasonsText = seasons
    ? ` • ${seasons} ${parseInt(seasons) === 1 ? 'Temporada' : 'Temporadas'}`
    : ''
  ctx.fillStyle = TEXT_MUTED
  ctx.font = `500 26px ${FONT_STACK}`
  ctx.fillText(`${conditionLabel}${seasonsText}`, LEFT, y)
  y += 40

  // Location — LEFT
  ctx.fillStyle = TEXT_MUTED
  ctx.font = `400 26px ${FONT_STACK}`
  ctx.fillText(`📍 ${location}`, LEFT, y)
  y += 56

  // Attributes grid (2 cols, up to 4) — LEFT
  const attrFields = (PRODUCT_ATTRIBUTES[product.product_type] || []).filter(
    (f) => !f.key.startsWith('incluye_') && !f.key.startsWith('fijaciones_'),
  )
  const attrs = (product.attributes || {}) as Record<string, unknown>
  const validAttrs = attrFields
    .filter((f) => {
      const v = attrs[f.key]
      return v !== undefined && v !== '' && v !== null
    })
    .slice(0, 4)

  if (validAttrs.length > 0) {
    const colW = IMG_SIZE / 2
    const rowH = 76
    validAttrs.forEach((f, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = LEFT + col * colW
      const cellY = y + row * rowH

      ctx.fillStyle = TEXT_SOFT
      ctx.font = `500 22px ${FONT_STACK}`
      ctx.fillText(f.label, x, cellY)

      const v = attrs[f.key]
      const display = typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v)
      ctx.fillStyle = TEXT
      ctx.font = `700 30px ${FONT_STACK}`
      ctx.fillText(display, x, cellY + 36)
    })
    y += Math.ceil(validAttrs.length / 2) * rowH + 24
  }

  // URL footer — light gray text, no chip, left-aligned
  ctx.fillStyle = TEXT_SOFT
  ctx.font = `500 24px ${FONT_STACK}`
  ctx.fillText('reskichile.cl', LEFT, Math.min(y + 10, H - 220))

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      0.92,
    )
  })
  const safeBrand = (product.brand || 'reski').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return new File([blob], `${safeBrand}-historia.jpg`, { type: 'image/jpeg' })
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = url
  })
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const imgRatio = img.width / img.height
  const dstRatio = dw / dh
  let sx = 0
  let sy = 0
  let sw = img.width
  let sh = img.height
  if (imgRatio > dstRatio) {
    sw = img.height * dstRatio
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / dstRatio
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
}

function drawTextEllipsized(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y)
    return
  }
  let s = text
  while (s.length > 0 && ctx.measureText(s + '…').width > maxWidth) {
    s = s.slice(0, -1)
  }
  ctx.fillText(s + '…', x, y)
}
