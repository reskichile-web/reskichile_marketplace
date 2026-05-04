/**
 * Elimina archivos huérfanos en storage (existen en storage pero no en product_images).
 * Solo borra carpetas con formato UUID (el formato viejo). Las carpetas slug/ no se tocan.
 *
 * Uso: node scripts/cleanup-orphan-storage.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = {}
readFileSync(join(__dirname, '../.env.local'), 'utf-8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && v.length) env[k.trim()] = v.join('=').trim()
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// Obtener paths válidos desde la DB
const { data: dbImages } = await supabase.from('product_images').select('url')
const validPaths = new Set(
  (dbImages || []).map(r => decodeURIComponent(r.url.split('/product-images/')[1] || ''))
)

// Listar todo en el root del bucket
const { data: rootEntries } = await supabase.storage.from('product-images').list('', { limit: 1000 })

const toDelete = []

for (const entry of (rootEntries || [])) {
  const isUuidFolder = uuidPattern.test(entry.name) || entry.name === 'anon'
  if (!isUuidFolder) continue

  // Listar contenido de la carpeta (userId o 'anon')
  const { data: level2 } = await supabase.storage.from('product-images').list(entry.name, { limit: 1000 })

  for (const sub of (level2 || [])) {
    const subPath = `${entry.name}/${sub.name}`

    // Si es archivo directo (tiene extensión), revisar si está en DB
    if (sub.name.includes('.')) {
      if (!validPaths.has(subPath)) toDelete.push(subPath)
      continue
    }

    // Si es sub-carpeta (productId), listar sus archivos
    const { data: files } = await supabase.storage.from('product-images').list(subPath, { limit: 100 })
    for (const file of (files || [])) {
      const filePath = `${subPath}/${file.name}`
      if (!validPaths.has(filePath)) toDelete.push(filePath)
    }
  }
}

if (toDelete.length === 0) {
  console.log('✅ Storage limpio — no hay archivos huérfanos.')
  process.exit(0)
}

console.log(`Encontrados ${toDelete.length} archivos huérfanos:`)
toDelete.forEach(p => console.log(' ', p))

// Borrar en lotes de 100 (límite de Supabase)
let deleted = 0
for (let i = 0; i < toDelete.length; i += 100) {
  const batch = toDelete.slice(i, i + 100)
  const { error } = await supabase.storage.from('product-images').remove(batch)
  if (error) console.error('Error borrando lote:', error.message)
  else deleted += batch.length
}

console.log(`\n✅ Eliminados ${deleted} archivos huérfanos del storage.`)
