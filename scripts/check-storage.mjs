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

const { data } = await supabase.from('product_images').select('url')
const paths = data.map(r => r.url.split('/product-images/')[1]).filter(Boolean)

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}/
const old = paths.filter(u => uuidPattern.test(u))
const newFmt = paths.filter(u => !uuidPattern.test(u))

console.log(`Total imágenes en DB: ${paths.length}`)
console.log(`✅ Formato nuevo (slug/): ${newFmt.length}`)
console.log(`❌ Formato viejo (UUID/): ${old.length}`)
if (old.length) {
  console.log('\nRutas antiguas:')
  old.forEach(u => console.log(' ', u))
}

// También listar archivos huérfanos en storage (están en storage pero no en DB)
console.log('\nListando archivos en storage...')
const { data: storageFiles } = await supabase.storage.from('product-images').list('', { limit: 1000 })
const folders = (storageFiles || []).filter(f => !f.name.includes('.'))

let orphans = []
for (const folder of folders) {
  const { data: files } = await supabase.storage.from('product-images').list(folder.name, { limit: 100 })
  for (const file of (files || [])) {
    const fullPath = `${folder.name}/${file.name}`
    const inDb = paths.some(p => decodeURIComponent(p) === fullPath || p === fullPath)
    if (!inDb) orphans.push(fullPath)
  }
}

console.log(`\n🗑  Archivos huérfanos (en storage pero no en DB): ${orphans.length}`)
if (orphans.length) orphans.forEach(p => console.log(' ', p))
