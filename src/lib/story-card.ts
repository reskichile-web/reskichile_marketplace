import { PRODUCT_TYPES, PRODUCT_ATTRIBUTES, CONDITIONS } from '@/lib/constants'
import type { ProductWithImages } from '@/lib/types'

const W = 1080
const H = 1920

// Image fills more of the canvas width; text aligns to the same left edge.
const IMG_SIZE = 800
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

  // Brand logo (SVG → canvas) — smaller, higher
  const logoW = 300
  const logoY = 130
  let logoH = 120
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

  // Product image card — wider than before
  const imgY = logoY + logoH + 40

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

  let y = imgY + IMG_SIZE + 70

  // Type label — CENTERED, bigger
  ctx.textAlign = 'center'
  ctx.fillStyle = BRAND
  ctx.font = `600 34px ${FONT_STACK}`
  ctx.fillText(typeLabel, W / 2, y)
  y += 70

  // Title — CENTERED, bigger
  ctx.fillStyle = TEXT
  ctx.font = `900 70px ${FONT_STACK}`
  drawTextEllipsized(ctx, title, W / 2, y, W - 100)
  y += 90

  // Everything below: LEFT-aligned at the image edge
  ctx.textAlign = 'left'

  // Price — LEFT, bigger
  ctx.fillStyle = BRAND
  ctx.font = `600 70px ${FONT_STACK}`
  ctx.fillText(price, LEFT, y)
  y += 60

  // Condition + seasons — LEFT, bigger
  const seasonsText = seasons
    ? ` • ${seasons} ${parseInt(seasons) === 1 ? 'Temporada' : 'Temporadas'}`
    : ''
  ctx.fillStyle = TEXT_MUTED
  ctx.font = `500 32px ${FONT_STACK}`
  ctx.fillText(`${conditionLabel}${seasonsText}`, LEFT, y)
  y += 52

  // Location — LEFT, bigger
  ctx.fillStyle = TEXT_MUTED
  ctx.font = `400 32px ${FONT_STACK}`
  ctx.fillText(`📍 ${location}`, LEFT, y)
  y += 70

  // Attributes grid (2 cols, up to 4) — LEFT, bigger
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
    const rowH = 88
    validAttrs.forEach((f, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = LEFT + col * colW
      const cellY = y + row * rowH

      ctx.fillStyle = TEXT_SOFT
      ctx.font = `500 26px ${FONT_STACK}`
      ctx.fillText(f.label, x, cellY)

      const v = attrs[f.key]
      const display = typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v)
      ctx.fillStyle = TEXT
      ctx.font = `700 38px ${FONT_STACK}`
      ctx.fillText(display, x, cellY + 44)
    })
    y += Math.ceil(validAttrs.length / 2) * rowH + 26
  }

  // Link-sticker drop zone — visible target so the user knows where to
  // place the IG Story link sticker after sharing. Replaces the URL
  // footer (the sticker carries the URL).
  const stickerW = 640
  const stickerH = 140
  const stickerX = (W - stickerW) / 2
  const stickerY = Math.min(y + 20, H - 260)

  ctx.save()
  ctx.fillStyle = 'rgba(38, 116, 191, 0.06)'
  roundRectPath(ctx, stickerX, stickerY, stickerW, stickerH, 30)
  ctx.fill()
  ctx.strokeStyle = BRAND
  ctx.lineWidth = 3
  ctx.setLineDash([12, 8])
  roundRectPath(ctx, stickerX, stickerY, stickerW, stickerH, 30)
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = BRAND
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 28px ${FONT_STACK}`
  ctx.fillText('🔗 Pegá aquí tu link de Reski', W / 2, stickerY + stickerH / 2)
  ctx.textBaseline = 'alphabetic'

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
