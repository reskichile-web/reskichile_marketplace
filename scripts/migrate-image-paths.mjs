/**
 * Migra las imágenes en storage al nuevo formato de nombre:
 *   ANTES: {userId}/{productId}/{brand}_{model}_{index}_{ts}.{ext}
 *   AHORA:  {slug}/{order+1}.{ext}   ej: salomon-qst-106-3f1a7a1d/1.jpg
 *
 * Uso:
 *   node scripts/migrate-image-paths.mjs
 *
 * - No re-descarga archivos: usa storage.move() (renombre directo en Supabase)
 * - Si una imagen ya está en el nuevo formato, la salta
 * - Actualiza la URL en product_images después de mover
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const envPath = join(__dirname, '../.env.local')
const env = {}
try {
  readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k && v.length) env[k.trim()] = v.join('=').trim()
  })
} catch {
  console.error('No se encontró .env.local')
  process.exit(1)
}

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function migrate() {
  console.log('Obteniendo productos e imágenes...\n')

  const { data: products, error } = await supabase
    .from('products')
    .select('id, slug, product_images(id, url, "order")')

  if (error) { console.error('Error al obtener productos:', error.message); process.exit(1) }

  let moved = 0
  let skipped = 0
  let failed = 0

  for (const product of products) {
    if (!product.slug) {
      console.log(`⚠️  Sin slug: producto ${product.id} — saltando`)
      skipped++
      continue
    }

    const images = (product.product_images || []).sort((a, b) => a.order - b.order)

    for (const img of images) {
      const urlParts = img.url.split('/product-images/')
      if (!urlParts[1]) {
        console.log(`⚠️  URL inesperada: ${img.url}`)
        skipped++
        continue
      }

      const oldPath = decodeURIComponent(urlParts[1])
      const ext = oldPath.split('.').pop() || 'jpg'
      const newPath = `${product.slug}/${img.order + 1}.${ext}`

      if (oldPath === newPath) {
        skipped++
        continue
      }

      const { error: moveError } = await supabase.storage
        .from('product-images')
        .move(oldPath, newPath)

      if (moveError) {
        console.error(`❌ No se pudo mover:\n   ${oldPath}\n   → ${newPath}\n   ${moveError.message}`)
        failed++
        continue
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(newPath)

      const { error: updateError } = await supabase
        .from('product_images')
        .update({ url: publicUrl })
        .eq('id', img.id)

      if (updateError) {
        console.error(`❌ Archivo movido pero falla al actualizar DB (imagen ${img.id}): ${updateError.message}`)
        failed++
        continue
      }

      console.log(`✅ ${oldPath}\n   → ${newPath}`)
      moved++
    }
  }

  console.log(`\n────────────────────────────`)
  console.log(`✅ Movidos:  ${moved}`)
  console.log(`⏭  Saltados: ${skipped}`)
  console.log(`❌ Fallidos: ${failed}`)
}

migrate()
