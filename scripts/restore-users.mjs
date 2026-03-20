/**
 * Script para restaurar usuarios borrados y re-vincular productos huérfanos
 *
 * Lee el Excel original, encuentra los usuarios que faltan en la BD,
 * los recrea en auth + users table, y re-vincula los productos huérfanos
 * haciendo match por brand + model + price.
 *
 * Uso: node scripts/restore-users.mjs
 */

import xlsx from 'xlsx'
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

const PRODUCT_TYPE_MAP = {
  'esquís': 'esquis', 'esquis': 'esquis',
  'snowboard': 'snowboards', 'snowboards': 'snowboards',
  'botas de esquí': 'botas_esqui', 'botas de esqui': 'botas_esqui',
  'botas de snowboard': 'botas_snowboard',
  'bastones': 'bastones',
  'casco': 'cascos', 'cascos': 'cascos',
  'guantes': 'guantes',
  'parka': 'parkas', 'parkas': 'parkas',
  'pantalones': 'pantalones',
  'antiparras': 'antiparras',
  'mochila': 'mochilas', 'mochilas': 'mochilas',
  'bolso': 'bolsos', 'bolsos': 'bolsos',
  'cámara de acción': 'camaras_accion', 'camara de accion': 'camaras_accion', 'cámaras de acción': 'camaras_accion',
  'fijaciones': 'fijaciones',
  'equipo de avalanchas': 'equipo_avalanchas', 'equipo avalanchas': 'equipo_avalanchas',
  'otros': 'otros',
}

function strVal(raw) {
  const s = String(raw || '').trim()
  return s === '' || s === '-' ? null : s
}

function numVal(raw) {
  const n = parseFloat(String(raw || '').replace(',', '.'))
  return isNaN(n) ? null : Math.round(n)
}

function extractBrandModel(type, row) {
  const map = {
    esquis: { brand: 'Marca de los esquís', model: 'Modelo de los esquís' },
    snowboards: { brand: 'Marca del snowboard', model: 'Modelo del snowboard' },
    botas_esqui: { brand: 'Marca de las Botas de Esquí', model: 'Modelo de las Botas de Esquí' },
    botas_snowboard: { brand: 'Marca de las Botas de Snowboard', model: 'Modelo de las Botas de Snowboard' },
    bastones: { brand: 'Marca de los Bastones', model: 'Modelo de los Bastones' },
    cascos: { brand: 'Marca del Casco', model: 'Modelo del Casco' },
    guantes: { brand: 'Marca de los Guantes', model: 'Modelo de los Guantes' },
    parkas: { brand: 'Marca de la Parka', model: 'Modelo de la Parka' },
    pantalones: { brand: 'Marca de los Pantalones', model: 'Modelo de los Pantalones' },
    antiparras: { brand: 'Marca de las Antiparras', model: 'Modelo de las Antiparras' },
    mochilas: { brand: 'Marca de la Mochila', model: 'Modelo de la Mochila' },
    bolsos: { brand: 'Marca del Bolso', model: 'Modelo del Bolso' },
    camaras_accion: { brand: 'Marca de la Cámara', model: 'Modelo de la Cámara' },
    fijaciones: { brand: 'Marca de las Fijaciones', model: 'Modelo de las Fijaciones' },
    equipo_avalanchas: { brand: 'Marca del Equipo', model: 'Modelo del Equipo' },
    otros: { brand: 'Otros Marca', model: 'Otros Modelo' },
  }
  const m = map[type]
  if (!m) return null
  return {
    brand: strVal(row[m.brand]) || 'Sin marca',
    model: strVal(row[m.model]),
  }
}

async function main() {
  const excelPath = join(__dirname, 'productos.xlsx')
  console.log(`\n📂 Leyendo Excel: ${excelPath}`)

  const workbook = xlsx.readFile(excelPath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' })
  console.log(`✅ ${rows.length} filas en Excel\n`)

  // Get orphaned products
  const { data: orphans } = await supabase
    .from('products')
    .select('id, brand, model, price, product_type')
    .is('seller_id', null)

  console.log(`🔍 ${orphans?.length || 0} productos huérfanos en BD\n`)

  // Get existing auth users
  const { data: existingAuth } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const authCache = {}
  existingAuth?.users?.forEach(u => {
    if (u.email) authCache[u.email.toLowerCase()] = u.id
  })

  let restored = 0
  let linked = 0
  let notFound = 0

  for (const row of rows) {
    const email = strVal(row['Email Address'])
    if (!email) continue

    const emailLower = email.toLowerCase()
    const name = strVal(row['Nombre y apellido'])
    const phone = strVal(row['Número de teléfono de contacto'])
    const instagram = strVal(row['Usuario de Instagram'])
    const price = numVal(row['Precio'])
    const typeRaw = strVal(row['Selecciona el tipo de producto que deseas vender'])
    if (!typeRaw || !price) continue

    const productType = PRODUCT_TYPE_MAP[typeRaw.toLowerCase().trim()]
    if (!productType) continue

    const fields = extractBrandModel(productType, row)
    if (!fields) continue

    // Find matching orphan product
    const match = orphans?.find(p =>
      p.brand === fields.brand &&
      (p.model || null) === (fields.model || null) &&
      p.price === price &&
      p.product_type === productType &&
      p.seller_id === undefined // not yet linked in this run
    )

    if (!match) continue

    // Get or create auth user
    let userId = authCache[emailLower]

    if (!userId) {
      const tempPassword = Math.random().toString(36).slice(-10) + 'A1!'
      const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
        email: emailLower,
        password: tempPassword,
        email_confirm: true,
      })
      if (authError) {
        console.error(`❌ Error creando auth user ${email}: ${authError.message}`)
        continue
      }
      userId = newUser.user.id
      authCache[emailLower] = userId
      restored++
    }

    // Upsert in users table
    await supabase.from('users').upsert({
      id: userId,
      email: emailLower,
      name: name || null,
      phone: phone || null,
      instagram: instagram ? instagram.replace(/^@/, '') : null,
      must_change_password: true,
    }, { onConflict: 'id' })

    // Link product
    const { error: updateErr } = await supabase
      .from('products')
      .update({ seller_id: userId })
      .eq('id', match.id)

    if (!updateErr) {
      // Mark as linked so we don't double-match
      match.seller_id = userId
      linked++
      console.log(`✅ ${fields.brand} ${fields.model || ''} → ${name || email}`)
    }
  }

  // Count remaining orphans
  const { data: remaining } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .is('seller_id', null)

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RESTAURACIÓN COMPLETADA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  👤 Usuarios restaurados:    ${restored}
  🔗 Productos re-vinculados: ${linked}
  ❓ Aún huérfanos:           ${remaining?.length || '?'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

main().catch(console.error)
