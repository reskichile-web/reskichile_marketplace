import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { launchBrowser } from './capture'
import type { CatalogProduct } from './catalog-contracts'
import { productCopy, prepareProductImage, renderHtml } from '../../../scripts/lib/ig-catalog.mjs'
import { prepareMountain } from '../../../scripts/lib/ig-catalog-mountain.mjs'
import { renderCatalogIntroHtml } from '../../../scripts/lib/ig-catalog-intro.mjs'

const dataUrl = (buffer: Buffer, mime: string) => `data:${mime};base64,${buffer.toString('base64')}`
const asset = (path: string) => readFile(join(process.cwd(), 'public', path))

async function getAssets() {
  const [logo, font, mountain, italicFont] = await Promise.all([
    asset('logo.svg'), asset('ig-assets/sourced/montserrat-latin-variable.woff2'),
    asset('images/_ (1).jpeg'), asset('ig-assets/sourced/montserrat-latin-italic-variable.woff2'),
  ])
  return {
    logo: dataUrl(Buffer.from(logo.toString().replaceAll('#2674bf', '#30465E')), 'image/svg+xml'),
    font: dataUrl(font, 'font/woff2'), italicFont: dataUrl(italicFont, 'font/woff2'),
    mountain: dataUrl(await prepareMountain(mountain, { softenSnow: true }), 'image/png'),
  }
}

async function prepareCard(product: CatalogProduct) {
  if (product.status !== 'approved' || !Number.isFinite(product.price) || product.price <= 0) throw new Error('Producto no publicable')
  const source = [...product.product_images].sort((a, b) => a.order - b.order)[0]?.url
  // Only fetch official storage assets, never arbitrary seller-supplied hosts.
  const url = new URL(source || '')
  const storageOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin
  if (url.origin !== storageOrigin || !url.pathname.startsWith('/storage/v1/object/public/')) throw new Error('La foto no pertenece al almacenamiento del catálogo')
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: 'error', cache: 'no-store' })
  if (!response.ok) throw new Error('No se pudo descargar la foto oficial')
  const image = await prepareProductImage(Buffer.from(await response.arrayBuffer()))
  let slug = (product.brand || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (slug === 'peakperformance') slug = 'peak-performance'
  const brandLogo = slug ? await asset(`brand-logos/${slug}.png`).then(b => dataUrl(b, 'image/png')).catch(() => null) : null
  return { ...product, copy: productCopy(product), image: dataUrl(image.png, 'image/png'),
    aspect: image.aspect, brandLogo, link: `https://www.reskichile.cl/producto/${encodeURIComponent(product.slug)}` }
}

/** Same HTML/CSS/assets as the approved local export, rendered inside Vercel. */
export async function renderCatalogJpeg(products: CatalogProduct[], position: number): Promise<Buffer> {
  const assets = await getAssets()
  const cards = []
  for (let i = 0; i < products.length; i += 3) cards.push(...await Promise.all(products.slice(i, i + 3).map(prepareCard)))
  const html = position === 0
    ? renderCatalogIntroHtml(assets)
    : renderHtml({ ...assets, cards, pageNumber: position, footerStyle: 'espaciada' })
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 })
    page.setDefaultTimeout(40_000)
    // All images/fonts are embedded; render cannot contact external sites.
    await page.setRequestInterception(true)
    page.on('request', request => {
      if (/^(data:|about:)/.test(request.url())) void request.continue()
      else void request.abort()
    })
    await page.setContent(html, { waitUntil: 'load', timeout: 40_000 })
    await page.evaluate(async () => {
      await document.fonts.ready
      if (![...document.fonts].some(face => face.family === 'Montserrat' && face.status === 'loaded')) throw new Error('Montserrat no se cargó')
      await Promise.all([...document.images].map(img => img.decode()))
      for (const element of document.querySelectorAll<HTMLElement>('[data-fit]')) {
        const minimum = Number(element.dataset.fit)
        let size = parseFloat(getComputedStyle(element).fontSize)
        while ((element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) && size > minimum) element.style.fontSize = `${--size}px`
      }
      for (const el of document.querySelectorAll<HTMLElement>('[data-fit], .price, .tagline, .website')) {
        if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) throw new Error('Texto fuera del área de la plantilla')
      }
      for (const el of document.querySelectorAll<HTMLElement>('.line, .reveal')) {
        if (el.scrollWidth > el.clientWidth + 1) throw new Error('Texto de intro fuera del ancho de la plantilla')
      }
    })
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920 } })
    return await sharp(Buffer.from(png)).flatten({ background: '#fafbfc' }).toColourspace('srgb')
      .jpeg({ quality: 94, chromaSubsampling: '4:4:4' }).toBuffer()
  } finally { await browser.close() }
}
