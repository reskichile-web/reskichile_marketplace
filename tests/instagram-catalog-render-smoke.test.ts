import { expect, it, vi } from 'vitest'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import nextEnv from '@next/env'
import sharp from 'sharp'
import { renderCatalogJpeg } from '@/lib/instagram/catalog-render'
import { readCatalogProducts } from '@/lib/instagram/catalog-selection'

// Explicit opt-in: downloads public products and renders locally. No upload,
// Meta call, private analytics read, database mutation or history bypass.
it.skipIf(process.env.RUN_CATALOG_RENDER_SMOKE !== 'true')('renders the approved templates with the server renderer', async () => {
  vi.stubEnv('NODE_ENV', 'production')
  nextEnv.loadEnvConfig(process.cwd())
  const products = (await readCatalogProducts()).slice(0, 18)
  expect(products.length).toBeGreaterThan(9)
  const directory = resolve('outputs', `ig-server-smoke-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  await mkdir(directory, { recursive: true })
  for (const [position, group] of [[], products.slice(0, 9), products.slice(9, 18)].entries()) {
    const jpeg = await renderCatalogJpeg(group, position)
    expect(await sharp(jpeg).metadata()).toMatchObject({ width: 1080, height: 1920, format: 'jpeg' })
    await writeFile(join(directory, `${position}.jpg`), jpeg)
  }
  console.log(`Server render preview: ${directory}`)
}, 180_000)
