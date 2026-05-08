import { PRODUCT_TYPES, PRODUCT_ATTRIBUTES, CONDITIONS } from '@/lib/constants'
import type { ProductWithImages } from '@/lib/types'

const W = 1080
const H = 1920

// Embedded product photo is rendered 4:5 (matches the catalog/product
// detail aspect). Side margins double as the left anchor for text.
const IMG_W = 760
const IMG_H = 950
const LEFT = (W - IMG_W) / 2

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

  // Brand logo (SVG → canvas) — small, near the top
  const logoW = 240
  const logoY = 110
  let logoH = 96
  try {
    const logo = await loadImage('/logo.svg')
    logoH = (logo.height / logo.width) * logoW
    ctx.drawImage(logo, (W - logoW) / 2, logoY, logoW, logoH)
  } catch {
    ctx.fillStyle = BRAND
    ctx.textAlign = 'center'
    ctx.font = `900 64px ${FONT_STACK}`
    ctx.fillText('ReskiChile', W / 2, logoY + 70)
  }

  // Product image card — 4:5 portrait
  const imgY = logoY + logoH + 35

  ctx.save()
  ctx.shadowColor = 'rgba(15, 23, 42, 0.15)'
  ctx.shadowBlur = 32
  ctx.shadowOffsetY = 12
  ctx.fillStyle = '#ffffff'
  roundRectPath(ctx, LEFT, imgY, IMG_W, IMG_H, 32)
  ctx.fill()
  ctx.restore()

  const imageUrl = product.product_images
    ?.slice()
    .sort((a, b) => a.order - b.order)[0]?.url

  if (imageUrl) {
    try {
      const img = await loadImage(imageUrl)
      ctx.save()
      roundRectPath(ctx, LEFT, imgY, IMG_W, IMG_H, 32)
      ctx.clip()
      drawCover(ctx, img, LEFT, imgY, IMG_W, IMG_H)
      ctx.restore()
    } catch {
      ctx.save()
      roundRectPath(ctx, LEFT, imgY, IMG_W, IMG_H, 32)
      ctx.clip()
      ctx.fillStyle = '#eef4fb'
      ctx.fillRect(LEFT, imgY, IMG_W, IMG_H)
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

  let y = imgY + IMG_H + 70

  // Type label — CENTERED
  ctx.textAlign = 'center'
  ctx.fillStyle = BRAND
  ctx.font = `600 34px ${FONT_STACK}`
  ctx.fillText(typeLabel, W / 2, y)
  y += 60

  // Title — CENTERED
  ctx.fillStyle = TEXT
  ctx.font = `900 70px ${FONT_STACK}`
  drawTextEllipsized(ctx, title, W / 2, y, W - 100)
  y += 84

  // Everything below: LEFT-aligned at the image edge
  ctx.textAlign = 'left'

  // Price — LEFT
  ctx.fillStyle = BRAND
  ctx.font = `600 64px ${FONT_STACK}`
  ctx.fillText(price, LEFT, y)
  y += 54

  // Condition + seasons — LEFT
  const seasonsText = seasons
    ? ` • ${seasons} ${parseInt(seasons) === 1 ? 'Temporada' : 'Temporadas'}`
    : ''
  ctx.fillStyle = TEXT_MUTED
  ctx.font = `500 30px ${FONT_STACK}`
  ctx.fillText(`${conditionLabel}${seasonsText}`, LEFT, y)
  y += 60

  // Location row dropped to make room for the 4:5 image.
  void location

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
    const colW = IMG_W / 2
    const rowH = 84
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
      ctx.font = `700 36px ${FONT_STACK}`
      ctx.fillText(display, x, cellY + 42)
    })
    y += Math.ceil(validAttrs.length / 2) * rowH + 18
  }

  // Link-sticker drop zone — visible target so the user knows where to
  // place the IG Story link sticker after sharing.
  const stickerW = 620
  const stickerH = 110
  const stickerX = (W - stickerW) / 2
  const stickerY = Math.min(y + 12, H - 230)

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
  ctx.font = `700 30px ${FONT_STACK}`
  ctx.fillText('🔗 Pegá aquí tu link de Reski', W / 2, stickerY + stickerH / 2)
  ctx.textBaseline = 'alphabetic'

  // Footer URL — light gray, centered, fills the remaining space below
  // the link-sticker drop zone.
  ctx.fillStyle = TEXT_SOFT
  ctx.textAlign = 'center'
  ctx.font = `500 24px ${FONT_STACK}`
  const footerY = Math.min(stickerY + stickerH + 36, H - 70)
  ctx.fillText('www.reskichile.cl', W / 2, footerY)

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
