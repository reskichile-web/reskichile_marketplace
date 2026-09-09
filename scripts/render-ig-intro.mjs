import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'
import { CATALOG_INTRO_COPY, renderCatalogIntroHtml } from './lib/ig-catalog-intro.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { values } = parseArgs({ options: { output: { type: 'string' }, help: { type: 'boolean' } } })
if (values.help) {
  console.log('npm run ig:intro [-- --output outputs/mi-intro]\nGenera intro PNG/JPEG 1080×1920 y HTML autónomo. No consulta productos ni publica.')
  process.exit(0)
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const output = resolve(values.output || join(root, 'outputs', `ig-intro-${stamp}`))
if (existsSync(output)) throw new Error('La carpeta ya existe; elige otra para conservar el diseño anterior.')
const executablePath = [process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean).find(path => existsSync(path))
if (!executablePath) throw new Error('No se encontró Chrome; define CHROME_PATH.')
const [logo, font] = await Promise.all([
  readFile(join(root, 'public/logo.svg'), 'utf8'),
  readFile(join(root, 'public/ig-assets/sourced/montserrat-latin-variable.woff2')),
])
const html = renderCatalogIntroHtml({
  logo: `data:image/svg+xml;base64,${Buffer.from(logo.replaceAll('#2674bf', '#30465E')).toString('base64')}`,
  font: `data:font/woff2;base64,${font.toString('base64')}`,
})
await mkdir(output, { recursive: true })
const htmlPath = join(output, 'intro.html')
await writeFile(htmlPath, html)
let browser
try {
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--hide-scrollbars', '--disable-background-networking'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' })
  const issues = await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map(img => img.decode()))
    const messages = []
    const montserrat = [...document.fonts].find(face => face.family === 'Montserrat')
    if (!montserrat || montserrat.status !== 'loaded') messages.push('Montserrat no se cargó; se cancela la exportación para evitar una fuente de reemplazo.')
    for (const el of document.querySelectorAll('.line, .reveal, .logo, .composition, .next-arrow')) {
      const bounds = el.getBoundingClientRect()
      if (el.scrollWidth > el.clientWidth + 1 || bounds.left < 64 || bounds.right > 1016 || bounds.top < 250 || bounds.bottom > 1670) {
        messages.push(`Elemento fuera del área segura: ${el.className}`)
      }
    }
    return messages
  })
  if (issues.length) throw new Error(issues.join('\n'))
  const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920 } })
  await writeFile(join(output, 'intro.png'), png)
  await sharp(png).toColourspace('srgb').jpeg({ quality: 94, chromaSubsampling: '4:4:4' }).toFile(join(output, 'intro.jpg'))
  await writeFile(join(output, 'manifest.json'), JSON.stringify({
    generatedAt: new Date().toISOString(), type: 'catalog-intro', copy: CATALOG_INTRO_COPY,
    width: 1080, height: 1920, html: 'intro.html', png: 'intro.png', jpeg: 'intro.jpg',
    productIds: [], published: false,
  }, null, 2) + '\n')
  console.log(`Intro: ${join(output, 'intro.png')}`)
} finally {
  await browser?.close()
}
