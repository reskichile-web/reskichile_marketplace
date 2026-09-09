import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'
import { PAGE_SIZE, fetchProducts, orderProducts, productCopy, prepareProductImage, renderHtml } from './lib/ig-catalog.mjs'
import { prepareMountain } from './lib/ig-catalog-mountain.mjs'
import { FOOTER_STYLES } from './lib/ig-catalog-footer.mjs'
import { TRENDING_CONFIG, fetchRecentProductViews, rankTrendingProducts } from './lib/ig-catalog-ranking.mjs'
import { CATALOG_ROTATION_DAYS, fetchCatalogAppearances, rotateCatalogProducts } from './lib/ig-catalog-rotation.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { values: options } = parseArgs({ options: {
  page: { type: 'string', default: '1' },
  pages: { type: 'string', default: '1' },
  all: { type: 'boolean', default: false },
  order: { type: 'string', default: 'trending' },
  footer: { type: 'string', default: 'espaciada' },
  output: { type: 'string' },
  help: { type: 'boolean', default: false },
  'preview-no-history': { type: 'boolean', default: false },
} })

if (options.help) {
  console.log(`Genera láminas 1080 × 1920 con nueve productos aprobados por hoja.

  npm run ig:catalog                         Primera hoja; carpeta nueva por ejecución
  npm run ig:catalog -- --page 2              Solo segunda hoja
  npm run ig:catalog -- --all                 Todo el catálogo
  npm run ig:catalog -- --pages 2             Primeras dos hojas
  npm run ig:catalog -- --order recent        Orden cronológico del catálogo
  npm run ig:catalog -- --order mixed         Intercalar categorías sin ranking
  npm run ig:catalog -- --preview-no-history  Boceto sin historial; no apto para publicar
  npm run ig:catalog -- --footer all          Comparar cuatro cierres en una hoja
  npm run ig:catalog -- --footer cursiva      Usar un cierre específico
  npm run ig:catalog -- --output outputs/mi-catalogo

Por defecto ordena por 50% novedad + 50% vistas únicas de los últimos siete días.
Evita repetir artículos durante 14 días; si faltan, usa los mostrados hace más tiempo.
Lee productos con clave anónima; trending requiere SUPABASE_SERVICE_ROLE_KEY
para leer analítica privada en este proceso local, nunca en el HTML exportado.
CHROME_PATH permite indicar un ejecutable de Chrome diferente.
No modifica productos ni publica en Instagram.`)
  process.exit(0)
}

const startPage = Number(options.page), requestedPages = Number(options.pages)
if (![startPage, requestedPages].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('--page y --pages deben ser enteros positivos.')
if (!['trending', 'mixed', 'recent'].includes(options.order)) throw new Error('--order debe ser trending, mixed o recent.')
if (options['preview-no-history'] && options.order !== 'trending') throw new Error('--preview-no-history solo aplica a trending.')
if (options.footer !== 'all' && !FOOTER_STYLES[options.footer]) throw new Error('--footer: original, cursiva, editorial, firma, espaciada o all.')
if (options.footer === 'all' && (options.all || requestedPages !== 1)) throw new Error('--footer all compara una hoja. Selecciónala con --page.')
const footerStyles = options.footer === 'all' ? ['cursiva', 'editorial', 'firma', 'espaciada'] : [options.footer]
if (options.all && (startPage !== 1 || requestedPages !== 1)) throw new Error('Usa --all sin --page ni --pages.')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const output = resolve(options.output || join(root, 'outputs', `ig-catalog-${stamp}`))
if (existsSync(output)) throw new Error(`La carpeta de salida ya existe: ${output}. Elige otra para conservar la exportación anterior.`)

nextEnv.loadEnvConfig(root)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.')
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
if (options.order === 'trending' && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Trending requiere SUPABASE_SERVICE_ROLE_KEY para leer las vistas. No se generará un ranking sin datos.')
}
const executablePath = [process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean).find(path => existsSync(path))
if (!executablePath) throw new Error('No se encontró Chrome; define CHROME_PATH.')

const dataUrl = (buffer, mime) => `data:${mime};base64,${buffer.toString('base64')}`

async function brandAvatar(brand = '') {
  // Same filename convention as src/lib/brand-logos.ts; use local curated assets.
  let slug = brand.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (slug === 'peakperformance') slug = 'peak-performance'
  const path = join(root, 'public/brand-logos', `${slug}.png`)
  return existsSync(path) ? dataUrl(await readFile(path), 'image/png') : null
}

async function prepareCard(product) {
  if (!Number.isFinite(product.price) || product.price <= 0) throw new Error(`Precio inválido: ${product.id}`)
  const sources = [...product.product_images].sort((a, b) => a.order - b.order)
  // Respect the listing's official main image; do not replace it with another model.
  if (!sources[0]?.url) throw new Error(`Falta foto en el producto ${product.id}`)
  const response = await fetch(sources[0].url, { signal: AbortSignal.timeout(30_000), cache: 'no-store' })
  if (!response.ok) throw new Error(`La foto de ${product.id} respondió ${response.status}`)
  const image = await prepareProductImage(Buffer.from(await response.arrayBuffer()))
  return {
    ...product,
    copy: productCopy(product),
    brandLogo: await brandAvatar(product.brand || ''),
    image: dataUrl(image.png, 'image/png'),
    aspect: image.aspect,
    sourceImage: sources[0].url,
    backgroundRemoved: image.backgroundRemoved,
    link: `https://www.reskichile.cl/producto/${encodeURIComponent(product.slug || product.id)}`,
  }
}

let browser
try {
  const activeProducts = await fetchProducts(client)
  const rankingAt = new Date()
  let selection = null
  let products
  if (options.order === 'trending') {
    const analytics = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const ids = activeProducts.map(product => product.id)
    const [views, appearances] = await Promise.all([
      fetchRecentProductViews(analytics, ids, rankingAt),
      options['preview-no-history'] ? Promise.resolve(new Map()) : fetchCatalogAppearances(analytics, ids, rankingAt),
    ])
    if (options['preview-no-history']) console.warn('SOLO PREVISUALIZACIÓN: se omite el historial de publicación; esta exportación no debe publicarse.')
    const ranked = rankTrendingProducts(activeProducts, views.counts, rankingAt)
    products = rotateCatalogProducts(ranked, appearances, rankingAt)
    selection = { ...TRENDING_CONFIG, evaluatedAt: rankingAt.toISOString(),
      viewsSince: views.since, viewsUntil: views.until, ignoredAnonymousEvents: views.ignoredAnonymousEvents,
      rankedProducts: ranked.map(product => ({ id: product.id, ...product.ranking })),
      rotation: { cooldownDays: CATALOG_ROTATION_DAYS,
        history: options['preview-no-history'] ? 'ignored-preview' : 'confirmed-catalog-publications',
        orderedProducts: products.map(product => ({ id: product.id, ...product.rotation })) } }
  } else {
    products = orderProducts(activeProducts, options.order)
  }
  const totalPages = Math.ceil(products.length / PAGE_SIZE)
  if (!products.length) throw new Error('No hay productos aprobados para generar el catálogo.')
  if (startPage > totalPages) throw new Error(`Solo hay ${totalPages} hojas disponibles.`)
  const endPage = options.all ? totalPages : Math.min(totalPages, startPage + requestedPages - 1)
  const generatedAt = new Date().toISOString()
  console.log(`${products.length} productos activos · ${totalPages} hojas posibles · generando ${startPage}–${endPage}.`)
  const [logoBuffer, fontBuffer, mountainBuffer, italicBuffer] = await Promise.all([
    readFile(join(root, 'public/logo.svg')),
    readFile(join(root, 'public/ig-assets/sourced/montserrat-latin-variable.woff2')),
    readFile(join(root, 'public/images/_ (1).jpeg')),
    readFile(join(root, 'public/ig-assets/sourced/montserrat-latin-italic-variable.woff2')),
  ])
  const mountain = await prepareMountain(mountainBuffer, { softenSnow: options.footer !== 'original' })
  const assets = {
    logo: dataUrl(Buffer.from(logoBuffer.toString('utf8').replaceAll('#2674bf', '#30465E')), 'image/svg+xml'),
    font: dataUrl(fontBuffer, 'font/woff2'),
    italicFont: dataUrl(italicBuffer, 'font/woff2'),
    mountain: dataUrl(mountain, 'image/png'),
  }
  const manifest = { generatedAt, previewOnly: options['preview-no-history'], dimensions: { width: 1080, height: 1920 }, order: options.order, selection,
    totalProducts: products.length, totalPages, catalogIds: products.map(p => p.id), sheets: [] }
  await mkdir(output, { recursive: true })
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--hide-scrollbars', '--disable-background-networking'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 })
  for (let n = startPage; n <= endPage; n++) {
    const selected = products.slice((n - 1) * PAGE_SIZE, n * PAGE_SIZE)
    const cards = []
    // Three image downloads at a time keeps memory bounded for the full catalog.
    for (let i = 0; i < selected.length; i += 3) {
      cards.push(...await Promise.all(selected.slice(i, i + 3).map(prepareCard)))
    }
    for (const footerStyle of footerStyles) {
    const name = `catalogo-${String(n).padStart(2, '0')}${footerStyle === 'original' ? '' : `-${footerStyle}`}`
    const htmlPath = join(output, `${name}.html`)
    await writeFile(htmlPath, renderHtml({ ...assets, cards, pageNumber: n, footerStyle }))
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' })
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all([...document.images].map(img => img.decode()))
      for (const element of document.querySelectorAll('[data-fit]')) {
        const minimum = Number(element.getAttribute('data-fit'))
        let size = parseFloat(getComputedStyle(element).fontSize)
        while ((element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) && size > minimum) {
          element.style.fontSize = `${--size}px`
        }
      }
    })
    const issues = await page.evaluate(() => {
      const messages = []
      for (const el of document.querySelectorAll('[data-fit], .price, .tagline, .website')) {
        if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) messages.push(`Texto desbordado: ${el.textContent}`)
      }
      const products = [...document.querySelectorAll('.product')]
      for (const product of products) {
        const rect = product.getBoundingClientRect()
        const last = product.querySelector('.location').getBoundingClientRect()
        if (last.bottom > rect.bottom + 1) messages.push(`Ficha fuera de su fila: ${product.textContent}`)
      }
      return messages
    })
    if (issues.length) throw new Error(issues.join('\n'))
    // Persist measured text sizes so the standalone HTML matches the PNG.
    await writeFile(htmlPath, await page.content())
    const pngPath = join(output, `${name}.png`)
    await page.screenshot({ path: pngPath, type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920 } })
    manifest.sheets.push({ page: n, footerStyle, png: `${name}.png`, html: `${name}.html`, products: cards.map(card => ({
      id: card.id, status: card.status, product_type: card.product_type,
      brand: card.brand, model: card.model, price: card.price, condition: card.condition,
      region: card.region, comuna: card.comuna, attributes: card.attributes,
      copy: card.copy, link: card.link, sourceImage: card.sourceImage,
      aspect: card.aspect, backgroundRemoved: card.backgroundRemoved,
      ranking: card.ranking ?? null,
      rotation: card.rotation ?? null,
    })) })
    console.log(`Hoja ${n}: ${pngPath}`)
    }
  }
  if (options.footer === 'all') {
    const footerTiles = [], fullTiles = []
    for (let i = 0; i < manifest.sheets.length; i++) {
      const sheet = manifest.sheets[i]
      const title = FOOTER_STYLES[sheet.footerStyle].label
      const label = Buffer.from(`<svg width="1080" height="60"><rect width="1080" height="60" fill="#eef0f2"/><text x="32" y="39" font-family="Arial" font-size="23" fill="#28323a">${title}</text></svg>`)
      const png = join(output, sheet.png)
      footerTiles.push({ input: label, left: 0, top: i * 360 })
      footerTiles.push({ input: await sharp(png).extract({ left: 0, top: 1620, width: 1080, height: 300 }).png().toBuffer(), left: 0, top: i * 360 + 60 })
      fullTiles.push({ input: await sharp(label).resize(540, 30).png().toBuffer(), left: (i % 2) * 560, top: Math.floor(i / 2) * 1010 })
      fullTiles.push({ input: await sharp(png).resize(540, 960).png().toBuffer(), left: (i % 2) * 560, top: Math.floor(i / 2) * 1010 + 30 })
    }
    await sharp({ create: { width: 1080, height: 1440, channels: 3, background: '#eef0f2' } }).composite(footerTiles).png().toFile(join(output, 'comparativa-cierres.png'))
    await sharp({ create: { width: 1100, height: 2000, channels: 3, background: '#eef0f2' } }).composite(fullTiles).png().toFile(join(output, 'comparativa-laminas.png'))
    manifest.comparisons = ['comparativa-cierres.png', 'comparativa-laminas.png']
  }
  await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Exportación completa: ${output}`)
} finally {
  await browser?.close()
}
