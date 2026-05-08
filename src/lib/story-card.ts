import { PRODUCT_TYPES } from '@/lib/constants'
import type { ProductWithImages } from '@/lib/types'

const W = 1080
const H = 1920

const BRAND = '#2674bf'
const BG_TOP = '#f6fbff'
const BG_BOTTOM = '#dbe9f7'
const TEXT = '#0f172a'
const TEXT_MUTED = '#64748b'

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

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

  // Top accent bar
  ctx.fillStyle = BRAND
  ctx.fillRect(0, 0, W, 14)

  // Brand header
  ctx.textAlign = 'center'
  ctx.fillStyle = BRAND
  ctx.font = `900 78px ${FONT_STACK}`
  ctx.fillText('ReskiChile', W / 2, 290)

  ctx.fillStyle = TEXT_MUTED
  ctx.font = `500 30px ${FONT_STACK}`
  ctx.fillText('Equipo de ski + snow • compra y vende', W / 2, 340)

  // Product image
  const imageUrl = product.product_images
    ?.slice()
    .sort((a, b) => a.order - b.order)[0]?.url

  const imgSize = 760
  const imgX = (W - imgSize) / 2
  const imgY = 410

  // Card backdrop with shadow (separate pass so the shadow only applies once)
  ctx.save()
  ctx.shadowColor = 'rgba(15, 23, 42, 0.18)'
  ctx.shadowBlur = 36
  ctx.shadowOffsetY = 14
  ctx.fillStyle = '#ffffff'
  roundRectPath(ctx, imgX, imgY, imgSize, imgSize, 44)
  ctx.fill()
  ctx.restore()

  if (imageUrl) {
    try {
      const img = await loadImage(imageUrl)
      ctx.save()
      roundRectPath(ctx, imgX, imgY, imgSize, imgSize, 44)
      ctx.clip()
      drawCover(ctx, img, imgX, imgY, imgSize, imgSize)
      ctx.restore()
    } catch {
      // CORS or load fail — leave white card with brand mark
      ctx.save()
      roundRectPath(ctx, imgX, imgY, imgSize, imgSize, 44)
      ctx.clip()
      ctx.fillStyle = '#eef4fb'
      ctx.fillRect(imgX, imgY, imgSize, imgSize)
      ctx.fillStyle = BRAND
      ctx.font = `900 110px ${FONT_STACK}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('ReskiChile', imgX + imgSize / 2, imgY + imgSize / 2)
      ctx.textBaseline = 'alphabetic'
      ctx.restore()
    }
  }

  // Text block
  const title = [product.brand, product.model].filter(Boolean).join(' ') || 'Producto'
  const typeLabel = PRODUCT_TYPES[product.product_type] || product.product_type
  const price = `$${product.price.toLocaleString('es-CL')}`
  const location = `${product.region}${product.comuna ? ', ' + product.comuna : ''}`

  let y = imgY + imgSize + 100

  ctx.textAlign = 'center'
  ctx.fillStyle = TEXT
  ctx.font = `900 64px ${FONT_STACK}`
  drawTextEllipsized(ctx, title, W / 2, y, W - 120)
  y += 60

  ctx.fillStyle = TEXT_MUTED
  ctx.font = `500 32px ${FONT_STACK}`
  ctx.fillText(typeLabel, W / 2, y)
  y += 110

  ctx.fillStyle = BRAND
  ctx.font = `900 116px ${FONT_STACK}`
  ctx.fillText(price, W / 2, y)
  y += 70

  ctx.fillStyle = TEXT_MUTED
  ctx.font = `500 28px ${FONT_STACK}`
  ctx.fillText(`📍 ${location}`, W / 2, y)
  y += 80

  // CTA chip
  const chipText = 'reskichile.cl'
  ctx.font = `700 32px ${FONT_STACK}`
  const chipW = ctx.measureText(chipText).width + 72
  const chipH = 64
  const chipX = (W - chipW) / 2
  ctx.fillStyle = BRAND
  roundRectPath(ctx, chipX, y, chipW, chipH, 32)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.fillText(chipText, W / 2, y + chipH / 2 + 2)
  ctx.textBaseline = 'alphabetic'

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      0.92
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
