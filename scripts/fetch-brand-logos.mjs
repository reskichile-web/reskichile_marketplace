// One-off: fetch curated brand logos into public/brand-logos/{slug}.png
//
//   node scripts/fetch-brand-logos.mjs
//
// Reads the BRAND_DOMAINS map from src/lib/brand-logos.ts, tries several public
// logo/favicon sources per domain, keeps the highest-resolution PNG that isn't a
// generic globe / tiny icon, and writes <slug>.png. Prints a report of what
// succeeded and which brands need a manual logo drop-in (small/regional brands
// like Lippi that no public source resolves cleanly).
//
// Safe to re-run: it skips brands that already have a curated file (delete the
// file to re-fetch it).

import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'

// DuckDuckGo's ip3 endpoint returns this generic grey chevron when it has no
// real icon for a domain (it 404s with the chevron as the body). It's a valid
// 48px PNG so the size check passes — blocklist it by content hash.
const JUNK_HASHES = new Set(['ab1fb25b83d4b333ea661a84bd298b2e'])

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'public', 'brand-logos')
const SRC = join(ROOT, 'src', 'lib', 'brand-logos.ts')

const MIN_WIDTH = 32 // reject globes (16px) and other junk

function slugify(brand) {
  return brand
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents: völkl -> volkl
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// PNG IHDR width is a big-endian uint32 at byte offset 16.
function pngWidth(buf) {
  if (buf.length < 24) return 0
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  if (!isPng) return 0
  return buf.readUInt32BE(16)
}

function isPng(buf) {
  return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
}

async function tryFetch(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (logo-fetch)' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok && res.status !== 404) return null // DDG sometimes 404s with a real body
    const buf = Buffer.from(await res.arrayBuffer())
    if (!isPng(buf)) return null // only keep PNGs so we can measure + serve uniformly
    const w = pngWidth(buf)
    if (w < MIN_WIDTH) return null
    const md5 = createHash('md5').update(buf).digest('hex')
    if (JUNK_HASHES.has(md5)) return null // generic chevron / known placeholder
    return { buf, width: w }
  } catch {
    return null
  }
}

function sources(domain) {
  return [
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://${domain}/apple-touch-icon.png`,
    `https://${domain}/apple-touch-icon-precomposed.png`,
  ]
}

// Parse BRAND_DOMAINS from the TS source (tolerant of escaped apostrophes).
function parseDomains() {
  const text = readFileSync(SRC, 'utf8')
  const body = text.slice(text.indexOf('BRAND_DOMAINS'))
  const re = /'((?:[^'\\]|\\.)*)':\s*'((?:[^'\\]|\\.)*)'/g
  const out = []
  let m
  while ((m = re.exec(body))) {
    const brand = m[1].replace(/\\'/g, "'")
    const domain = m[2].replace(/\\'/g, "'")
    if (brand && domain.includes('.')) out.push({ brand, domain })
  }
  return out
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const entries = parseDomains()

  // De-dupe by slug (völkl/volkl, north face/the north face share a logo).
  const bySlug = new Map()
  for (const e of entries) {
    const slug = slugify(e.brand)
    if (!bySlug.has(slug)) bySlug.set(slug, { slug, ...e })
  }

  const saved = []
  const failed = []
  const skipped = []

  for (const { slug, brand, domain } of bySlug.values()) {
    const file = join(OUT_DIR, `${slug}.png`)
    if (existsSync(file)) {
      skipped.push(slug)
      continue
    }
    let best = null
    let bestSource = ''
    for (const url of sources(domain)) {
      const r = await tryFetch(url)
      if (r && (!best || r.width > best.width)) {
        best = r
        bestSource = url.split('/')[2]
      }
      if (best && best.width >= 128) break // good enough, stop early
    }
    if (best) {
      writeFileSync(file, best.buf)
      saved.push({ slug, domain, width: best.width, src: bestSource })
      console.log(`  ✓ ${slug.padEnd(22)} ${String(best.width).padStart(3)}px  ${bestSource}`)
    } else {
      failed.push({ slug, brand, domain })
      console.log(`  ✗ ${slug.padEnd(22)} no usable logo  (${domain})`)
    }
  }

  console.log('\n──────── REPORT ────────')
  console.log(`saved:   ${saved.length}`)
  console.log(`skipped: ${skipped.length} (already present)`)
  console.log(`FAILED (need manual logo): ${failed.length}`)
  for (const f of failed) console.log(`   - ${f.brand}  (${f.domain})  ->  public/brand-logos/${f.slug}.png`)

  // Low-res ones worth eyeballing
  const lowres = saved.filter(s => s.width < 64).sort((a, b) => a.width - b.width)
  if (lowres.length) {
    console.log(`\nLOW-RES (<64px, QA manually): ${lowres.length}`)
    for (const s of lowres) console.log(`   - ${s.slug}  ${s.width}px  (${s.src})`)
  }

  const files = readdirSync(OUT_DIR).filter(f => f.endsWith('.png'))
  console.log(`\nTotal curated files now in public/brand-logos/: ${files.length}`)
}

main()
