import sharp from 'sharp'
import { FOOTER_STYLES } from './ig-catalog-footer.mjs'

export const PAGE_SIZE = 9
const TYPES = {
  esquis: 'Esquís', snowboards: 'Snowboard', botas_esqui: 'Botas de esquí',
  botas_snowboard: 'Botas de snowboard', fijaciones: 'Fijaciones',
  antiparras: 'Antiparras', mochilas: 'Mochila', parkas: 'Parka',
  pantalones: 'Pantalones', cascos: 'Casco', guantes: 'Guantes',
  bastones: 'Bastones', bolsos: 'Bolso', equipo_avalanchas: 'Avalanchas',
  camaras_accion: 'Cámara de acción', equipos_completos: 'Equipo completo', otros: 'Accesorio',
}
const CONDITIONS = {
  nuevo_sellado: 'Nuevo sellado', nuevo: 'Nuevo', usado_como_nuevo: 'Como nuevo',
  usado_buen_estado: 'Buen estado', usado_aceptable: 'Usado aceptable',
}

// Explicit public fields only. No seller contacts or service-role access.
export async function fetchProducts(client) {
  const products = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('products')
      .select('id, slug, status, created_at, product_type, brand, model, price, condition, region, comuna, attributes, product_images(url, order)')
      .eq('status', 'approved')
      .order('catalog_bumped_at', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + 499)
    if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`)
    products.push(...data)
    if (data.length < 500) break
  }
  if (new Set(products.map(p => p.id)).size !== products.length) {
    throw new Error('El catálogo cambió durante la consulta; vuelve a ejecutar el comando.')
  }
  return products
}

// Each cycle consumes every item once: skis, boards, then other equipment.
// It gives the first sheet the reference's visual rhythm without fixed IDs.
/**
 * @template {{ status: string, product_type: string }} T
 * @param {T[]} products
 * @param {'mixed' | 'recent'} [order]
 * @returns {T[]}
 */
export function orderProducts(products, order = 'mixed') {
  const active = products.filter(p => p.status === 'approved')
  if (order === 'recent') return active
  const groups = [
    active.filter(p => p.product_type === 'esquis'),
    active.filter(p => p.product_type === 'snowboards'),
    active.filter(p => !['esquis', 'snowboards'].includes(p.product_type)),
  ]
  const result = []
  while (groups.some(group => group.length)) {
    for (const group of groups) result.push(...group.splice(0, 3))
  }
  return result
}

export function productCopy(product) {
  const a = product.attributes || {}
  const type = TYPES[product.product_type] || 'Producto'
  const facts = []
  if (['esquis', 'snowboards'].includes(product.product_type)) {
    const length = a.largo_cm || a.largo
    if (length) facts.push(`${String(length).replace(/\s*cm$/i, '')} cm`)
    if (product.product_type === 'esquis' && a.ancho_mm) facts.push(`${a.ancho_mm} mm`)
    if (product.product_type === 'snowboards' && a.incluye_fijaciones === true) facts.push('Con fijaciones')
  } else if (product.product_type.startsWith('botas_')) {
    const size = a.talla_mondo || a.talla_cm
    if (size) facts.push(`Mondo ${size}`)
    if (a.flex) facts.push(`Flex ${a.flex}`)
  } else if (a.capacidad_litros) facts.push(`${a.capacidad_litros} L`)
  else if (a.talla) facts.push(`Talla ${a.talla}`)
  else if (a.tipo_equipo) facts.push(a.tipo_equipo)
  facts.push(CONDITIONS[product.condition] || 'Estado por confirmar')
  const location = [product.comuna, product.region].find(v => v?.trim() && !/^por confirmar$/i.test(v.trim()))
  return {
    type,
    brand: product.brand?.trim() || type,
    model: product.model?.trim() || type,
    detail: facts.join(' · '),
    location: location?.trim() || 'Ubicación por confirmar',
    price: new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(product.price),
  }
}

// Remove only near-white pixels connected to an edge. White product panels
// enclosed by a darker outline keep their opacity and original RGB values.
// This is for the catalog's studio cutouts, not semantic background removal.
export async function prepareProductImage(buffer) {
  const { data, info } = await sharp(buffer).rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const count = width * height
  const seen = new Uint8Array(count)
  const queue = new Int32Array(count)
  let tail = 0
  const background = index => data[index * 4 + 3] < 16 || (
    data[index * 4] >= 243 && data[index * 4 + 1] >= 243 && data[index * 4 + 2] >= 243
  )
  const add = index => {
    if (!seen[index] && background(index)) {
      seen[index] = 1
      queue[tail++] = index
    }
  }
  for (let x = 0; x < width; x++) { add(x); add((height - 1) * width + x) }
  for (let y = 0; y < height; y++) { add(y * width); add(y * width + width - 1) }
  for (let head = 0; head < tail; head++) {
    const index = queue[head]
    data[index * 4 + 3] = 0
    if (index % width > 0) add(index - 1)
    if (index % width < width - 1) add(index + 1)
    if (index >= width) add(index - width)
    if (index < count - width) add(index + width)
  }
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] < 32) continue
      if (data[i] >= 246 && data[i + 1] >= 246 && data[i + 2] >= 246) continue
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
  }
  if (maxX < minX) throw new Error('La imagen está vacía o es completamente blanca.')
  const padding = 8
  const left = Math.max(0, minX - padding), top = Math.max(0, minY - padding)
  const cropWidth = Math.min(width - left, maxX - minX + padding * 2 + 1)
  const cropHeight = Math.min(height - top, maxY - minY + padding * 2 + 1)
  const png = await sharp(data, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: cropWidth, height: cropHeight }).png().toBuffer()
  return { png, aspect: cropWidth / cropHeight, backgroundRemoved: tail / count }
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

export function renderHtml({ cards, logo, mountain, font, italicFont, pageNumber, footerStyle = 'espaciada' }) {
  const esc = escapeHtml
  const footer = FOOTER_STYLES[footerStyle]
  if (!footer) throw new Error(`Cierre desconocido: ${footerStyle}`)
  // Short accessories have more empty space above their photo. Move each row
  // up by half that extra space, preserving aligned captions within the row.
  const rowOffsets = []
  for (let i = 0; i < cards.length; i += 3) {
    const row = cards.slice(i, i + 3)
    const heights = row.map(card => ['esquis', 'snowboards', 'bastones'].includes(card.product_type)
      ? Math.min(270, 248 / card.aspect)
      : Math.min(229, 246 / card.aspect))
    const averageHeight = heights.reduce((sum, height) => sum + height, 0) / heights.length
    rowOffsets.push(-Math.round((270 - averageHeight) / 2))
  }
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=1080"><title>ReskiChile · Catálogo ${pageNumber}</title>
<style>
@font-face{font-family:Montserrat;src:url('${font}') format('woff2');font-weight:100 900;font-display:block}
${italicFont ? `@font-face{font-family:Montserrat;src:url('${italicFont}') format('woff2');font-weight:100 900;font-style:italic;font-display:block}` : ''}
*{box-sizing:border-box}body{margin:0;background:#edf0f2;font-family:Montserrat,Arial,sans-serif;color:#20272d;-webkit-font-smoothing:antialiased}
.sheet{position:relative;width:1080px;height:1920px;overflow:hidden;background:#fafbfc}
header{position:absolute;top:58px;left:60px;right:60px;text-align:center}
.logo{display:block;width:196px;height:79px;object-fit:contain;margin:0 auto 22px}
.grid{position:absolute;left:72px;right:72px;top:236px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:54px;row-gap:97px}
.product{height:413px;min-width:0;text-align:center;text-decoration:none;color:inherit;transform:translateY(var(--row-offset,0px))}
.art{height:287px;position:relative;display:flex;align-items:flex-end;justify-content:center;padding:0 14px 13px;isolation:isolate}
.art:before{content:'';position:absolute;width:var(--shadow);height:15px;bottom:5px;left:50%;transform:translateX(-50%);background:radial-gradient(ellipse,rgba(30,40,50,.24),rgba(30,40,50,.06) 48%,transparent 73%);filter:blur(4px);z-index:-1}
.art img{display:block;max-width:100%;width:auto;height:auto;max-height:270px;object-fit:contain;filter:drop-shadow(3px 6px 4px rgba(25,35,45,.09))}
.art.compact img{max-height:229px;max-width:246px;margin-bottom:1px}
.copy{padding-top:14px}
.identity{height:36px;display:flex;align-items:center;gap:9px;text-align:left;min-width:0}
.avatar{width:30px;height:30px;flex:0 0 30px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#f0f2f3;overflow:hidden;color:#53616b;font-size:11px;font-weight:700}
.avatar img{width:23px;height:23px;object-fit:contain;mix-blend-mode:multiply}
.name{font-size:20px;font-weight:550;line-height:30px;letter-spacing:-.45px;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.price{font-size:34px;font-weight:800;line-height:46px;letter-spacing:-1.2px;color:#20272d;white-space:nowrap}
.location{font-size:18px;line-height:26px;color:#536572;display:flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap}
.location svg{width:15px;height:15px;flex:none;stroke:#6a7d8b}
.mountain{position:absolute;bottom:-42px;left:0;width:1080px;height:auto;opacity:.62;filter:saturate(.35)}
footer{position:absolute;top:1780px;left:72px;right:72px;text-align:center}
.tagline{font-size:26px;line-height:36px;font-weight:500;letter-spacing:-.6px;margin-bottom:10px}
.website{font-size:15px;font-weight:650;letter-spacing:4px;color:#2674bf}
${footer.css}
</style></head><body><main class="sheet">
<header><img class="logo" src="${logo}" alt="ReskiChile"></header>
<section class="grid">${cards.map((card, index) => {
    const p = card.copy
    const title = [p.brand, p.model].filter((value, index, all) => all.indexOf(value) === index).join(' ')
    const avatar = card.brandLogo
      ? `<img src="${card.brandLogo}" alt="${esc(p.brand)}">`
      : esc(p.brand.slice(0, 2).toUpperCase())
    const long = ['esquis', 'snowboards', 'bastones'].includes(card.product_type)
    const shadow = Math.min(208, Math.max(60, card.aspect * (long ? 246 : 190) * .8))
    return `<a class="product" href="${esc(card.link)}" data-product-id="${esc(card.id)}" style="--row-offset:${rowOffsets[Math.floor(index / 3)]}px">
<div class="art ${long ? '' : 'compact'}" style="--shadow:${shadow}px"><img src="${card.image}" alt="${esc(`${p.brand} ${p.model}`)}"></div>
<div class="copy"><div class="identity"><span class="avatar">${avatar}</span><span class="name" title="${esc(title)}">${esc(title)}</span></div>
<div class="price" data-fit="28">${esc(p.price)}</div>
<div class="location" data-fit="14"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.7"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg><span>${esc(p.location)}</span></div></div></a>`
  }).join('')}</section>
<img class="mountain" src="${mountain}" alt="Montaña nevada">
<footer>${footer.html || '<div class="tagline">El snowmarket de Chile.</div><div class="website">reskichile.cl</div>'}</footer>
</main></body></html>`
}
