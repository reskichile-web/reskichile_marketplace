/**
 * Script de re-importación de productos desde Excel
 *
 * 1. Borra todos los productos existentes
 * 2. Re-importa desde productos.xlsx
 * 3. Reporta discrepancias
 *
 * Uso: node scripts/reimport-products.mjs
 */

import xlsx from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Config ────────────────────────────────────────────────────────────────
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

// ─── Mappings ───────────────────────────────────────────────────────────────

const PRODUCT_TYPE_MAP = {
  'esquís': 'esquis',
  'esquis': 'esquis',
  'snowboard': 'snowboards',
  'snowboards': 'snowboards',
  'botas de esquí': 'botas_esqui',
  'botas de esqui': 'botas_esqui',
  'botas de snowboard': 'botas_snowboard',
  'bastones': 'bastones',
  'casco': 'cascos',
  'cascos': 'cascos',
  'guantes': 'guantes',
  'parka': 'parkas',
  'parkas': 'parkas',
  'pantalones': 'pantalones',
  'antiparras': 'antiparras',
  'mochila': 'mochilas',
  'mochilas': 'mochilas',
  'bolso': 'bolsos',
  'bolsos': 'bolsos',
  'cámara de acción': 'camaras_accion',
  'camara de accion': 'camaras_accion',
  'cámaras de acción': 'camaras_accion',
  'fijaciones': 'fijaciones',
  'equipo de avalanchas': 'equipo_avalanchas',
  'equipo avalanchas': 'equipo_avalanchas',
  'otros': 'otros',
}

const CONDITION_MAP = {
  'nuevo (sellado)': 'nuevo_sellado',
  'nuevo sellado': 'nuevo_sellado',
  'nuevo': 'nuevo',
  'nuevo sin uso': 'nuevo',
  'usado - como nuevo': 'usado_como_nuevo',
  'como nuevo': 'usado_como_nuevo',
  'usado - buen estado': 'usado_buen_estado',
  'buen estado': 'usado_buen_estado',
  'usado - aceptable': 'usado_aceptable',
  'aceptable': 'usado_aceptable',
}

function mapProductType(raw) {
  if (!raw) return null
  return PRODUCT_TYPE_MAP[raw.toLowerCase().trim()] || null
}

function mapCondition(raw) {
  if (!raw) return null
  return CONDITION_MAP[raw.toLowerCase().trim()] || 'usado_buen_estado'
}

function boolVal(raw) {
  if (!raw) return false
  const s = String(raw).toLowerCase().trim()
  return s === 'sí' || s === 'si' || s === 'yes' || s === 'true' || s === '1'
}

function numVal(raw) {
  const n = parseFloat(String(raw || '').replace(',', '.'))
  return isNaN(n) ? null : Math.round(n)
}

function strVal(raw) {
  const s = String(raw || '').trim()
  return s === '' || s === '-' ? null : s
}

// ─── Extrae atributos dinámicos según tipo de producto ──────────────────────

function extractAttributes(type, row) {
  const attrs = {}

  if (type === 'esquis') {
    if (row['Largo de los esquís (cm)']) attrs.largo_cm = numVal(row['Largo de los esquís (cm)'])
    if (row['Ancho de los Esquís (mm)']) attrs.ancho_mm = numVal(row['Ancho de los Esquís (mm)'])
    if (row['Radio de giro (m)']) attrs.radio_giro_m = numVal(row['Radio de giro (m)'])
    const inclFij = row['Incluyen fijaciones los esquís']
    attrs.incluye_fijaciones = boolVal(inclFij)
    if (attrs.incluye_fijaciones) {
      if (row['Marca de las fijaciones de los esquís']) attrs.fijaciones_marca = strVal(row['Marca de las fijaciones de los esquís'])
      if (row['Modelo de las fijaciones de los esquís']) attrs.fijaciones_modelo = strVal(row['Modelo de las fijaciones de los esquís'])
      if (row['Tipo de conexión a las botas de las fijaciones de los esquís']) attrs.fijaciones_tipo_conexion = strVal(row['Tipo de conexión a las botas de las fijaciones de los esquís'])
      if (row['Estado de las fijaciones de los esquís']) attrs.fijaciones_estado = strVal(row['Estado de las fijaciones de los esquís'])
    }
  }

  else if (type === 'snowboards') {
    if (row['Largo del snowboard']) attrs.largo = strVal(row['Largo del snowboard'])
    if (row['Ancho del snowboard']) attrs.ancho = strVal(row['Ancho del snowboard'])
    if (row['Camber']) attrs.camber = strVal(row['Camber'])
    const inclFij = row['Incluye fijaciones el snowboard']
    attrs.incluye_fijaciones = boolVal(inclFij)
    if (attrs.incluye_fijaciones) {
      if (row['Marca de las fijaciones del snowboard']) attrs.fijaciones_marca = strVal(row['Marca de las fijaciones del snowboard'])
      if (row['Modelo de las fijaciones del snowboard']) attrs.fijaciones_modelo = strVal(row['Modelo de las fijaciones del snowboard'])
      if (row['Tipo de conexión a las botas de las fijaciones del snowboard']) attrs.fijaciones_tipo_conexion = strVal(row['Tipo de conexión a las botas de las fijaciones del snowboard'])
      if (row['Estado de las fijaciones del snowboard']) attrs.fijaciones_estado = strVal(row['Estado de las fijaciones del snowboard'])
    }
  }

  else if (type === 'botas_esqui') {
    if (row['Flex']) attrs.flex = strVal(row['Flex'])
    if (row['Talla (Mondo)']) attrs.talla_mondo = strVal(row['Talla (Mondo)'])
    if (row['Talla en cm de las Botas de Esquí']) attrs.talla_cm = strVal(row['Talla en cm de las Botas de Esquí'])
    if (row['Tipo de Conexión a la Fijación del Esquí']) attrs.tipo_conexion_fijacion = strVal(row['Tipo de Conexión a la Fijación del Esquí'])
    if (row['Color de las Botas de Esquí']) attrs.color = strVal(row['Color de las Botas de Esquí'])
    if (row['Sexo de las Botas de Esquí']) attrs.sexo = strVal(row['Sexo de las Botas de Esquí'])
  }

  else if (type === 'botas_snowboard') {
    if (row['Talla en cm de las Botas de Snowboard']) attrs.talla_cm = strVal(row['Talla en cm de las Botas de Snowboard'])
    if (row['Tipo de Conexión a la Fijación del Snowboard']) attrs.tipo_conexion_fijacion = strVal(row['Tipo de Conexión a la Fijación del Snowboard'])
    if (row['Color de las Botas de Snowboard']) attrs.color = strVal(row['Color de las Botas de Snowboard'])
    if (row['Sexo de las Botas de Snowboard']) attrs.sexo = strVal(row['Sexo de las Botas de Snowboard'])
  }

  else if (type === 'bastones') {
    if (row['Largo de los Bastones']) attrs.largo = strVal(row['Largo de los Bastones'])
    if (row['Bastones Telescópicos']) attrs.telescopicos = boolVal(row['Bastones Telescópicos'])
  }

  else if (type === 'cascos') {
    if (row['Color del Casco']) attrs.color = strVal(row['Color del Casco'])
    if (row['Talla en cm del Casco']) attrs.talla_cm = strVal(row['Talla en cm del Casco'])
    if (row['Talla del Casco']) attrs.talla = strVal(row['Talla del Casco'])
  }

  else if (type === 'guantes') {
    if (row['Talla de los Guantes']) attrs.talla = strVal(row['Talla de los Guantes'])
    if (row['Sexo de los Guantes']) attrs.sexo = strVal(row['Sexo de los Guantes'])
  }

  else if (type === 'parkas') {
    if (row['Tipo de aislación de la Parka']) attrs.tipo_aislacion = strVal(row['Tipo de aislación de la Parka'])
    if (row['Sexo de la Parka']) attrs.sexo = strVal(row['Sexo de la Parka'])
    if (row['Talla de la Parka']) attrs.talla = strVal(row['Talla de la Parka'])
  }

  else if (type === 'pantalones') {
    if (row['Tipo de aislación de los Pantalones']) attrs.tipo_aislacion = strVal(row['Tipo de aislación de los Pantalones'])
    if (row['Sexo de los Pantalones']) attrs.sexo = strVal(row['Sexo de los Pantalones'])
    if (row['Talla de los Pantalones']) attrs.talla = strVal(row['Talla de los Pantalones'])
    if (row['Talla de los Pantalones (Número)']) attrs.talla_numero = strVal(row['Talla de los Pantalones (Número)'])
  }

  else if (type === 'antiparras') {
    if (row['Lente intercambiable']) attrs.lente_intercambiable = boolVal(row['Lente intercambiable'])
    if (row['Talla de las Antiparras']) attrs.talla = strVal(row['Talla de las Antiparras'])
  }

  else if (type === 'mochilas') {
    if (row['Capacidad (Litros) de la Mochila']) attrs.capacidad_litros = strVal(row['Capacidad (Litros) de la Mochila'])
    if (row['Compartimiento para equipo de avalancha']) attrs.compartimiento_avalancha = boolVal(row['Compartimiento para equipo de avalancha'])
  }

  else if (type === 'bolsos') {
    if (row['Capacidad (Litros) del Bolso']) attrs.capacidad_litros = strVal(row['Capacidad (Litros) del Bolso'])
    if (row['Tiene ruedas']) attrs.tiene_ruedas = boolVal(row['Tiene ruedas'])
    if (row['Largo del Bolso']) attrs.largo = strVal(row['Largo del Bolso'])
  }

  else if (type === 'camaras_accion') {
    if (row['Tipo de Grabación']) attrs.tipo_grabacion = strVal(row['Tipo de Grabación'])
  }

  else if (type === 'fijaciones') {
    if (row['Tipo de Conexión de las Fijaciones']) attrs.tipo_conexion = strVal(row['Tipo de Conexión de las Fijaciones'])
  }

  else if (type === 'equipo_avalanchas') {
    if (row['Equipo']) attrs.tipo_equipo = strVal(row['Equipo'])
  }

  Object.keys(attrs).forEach(k => attrs[k] === null && delete attrs[k])
  return Object.keys(attrs).length > 0 ? attrs : null
}

// ─── Extrae brand/model/condition/seasons/description por tipo ──────────────

function extractProductFields(type, row) {
  const brandModelMap = {
    esquis:            { brand: 'Marca de los esquís', model: 'Modelo de los esquís', condition: 'Estado de los esquís', seasons: 'Temporadas de uso de los esquís', desc: 'Descripción extra de los esquís (opcional)' },
    snowboards:        { brand: 'Marca del snowboard', model: 'Modelo del snowboard', condition: 'Estado del snowboard', seasons: 'Temporadas de uso del snowboard', desc: 'Descripción extra del snowboard (opcional)' },
    botas_esqui:       { brand: 'Marca de las Botas de Esquí', model: 'Modelo de las Botas de Esquí', condition: 'Estado de las Botas de Esquí', seasons: 'Temporadas de uso de las Botas de Esquí', desc: 'Descripción extra de las Botas de Esquí (opcional)' },
    botas_snowboard:   { brand: 'Marca de las Botas de Snowboard', model: 'Modelo de las Botas de Snowboard', condition: 'Estado de las Botas de Snowboard', seasons: 'Temporadas de uso de las Botas de Snowboard', desc: 'Descripción extra de las Botas de Snowboard (opcional)' },
    bastones:          { brand: 'Marca de los Bastones', model: 'Modelo de los Bastones', condition: 'Estado de los Bastones', seasons: 'Temporadas de uso de los Bastones', desc: 'Descripción extra de los Bastones (opcional)' },
    cascos:            { brand: 'Marca del Casco', model: 'Modelo del Casco', condition: 'Estado del Casco', seasons: 'Temporadas de uso del Casco', desc: 'Descripción extra del Casco (opcional)' },
    guantes:           { brand: 'Marca de los Guantes', model: 'Modelo de los Guantes', condition: 'Estado de los Guantes', seasons: 'Temporadas de uso de los Guantes', desc: 'Descripción extra de los Guantes (opcional)' },
    parkas:            { brand: 'Marca de la Parka', model: 'Modelo de la Parka', condition: 'Estado de la Parka', seasons: 'Temporadas de uso de la Parka', desc: 'Descripción extra de la Parka (opcional)' },
    pantalones:        { brand: 'Marca de los Pantalones', model: 'Modelo de los Pantalones', condition: 'Estado de los Pantalones', seasons: 'Temporadas de uso de los Pantalones', desc: 'Descripción extra de los Pantalones (opcional)' },
    antiparras:        { brand: 'Marca de las Antiparras', model: 'Modelo de las Antiparras', condition: 'Estado de las Antiparras', seasons: 'Temporadas de uso de las Antiparras', desc: 'Descripción extra de las Antiparras (opcional)' },
    mochilas:          { brand: 'Marca de la Mochila', model: 'Modelo de la Mochila', condition: 'Estado de la Mochila', seasons: 'Temporadas de uso de la Mochila', desc: 'Descripción extra de la Mochila (opcional)' },
    bolsos:            { brand: 'Marca del Bolso', model: 'Modelo del Bolso', condition: 'Estado del Bolso', seasons: null, desc: 'Descripción extra del Bolso (opcional)' },
    camaras_accion:    { brand: 'Marca de la Cámara', model: 'Modelo de la Cámara', condition: 'Estado de la Cámara', seasons: null, desc: 'Descripción extra de la Cámara (opcional)' },
    fijaciones:        { brand: 'Marca de las Fijaciones', model: 'Modelo de las Fijaciones', condition: 'Estado de las Fijaciones', seasons: null, desc: 'Descripción extra de las Fijaciones (opcional)' },
    equipo_avalanchas: { brand: 'Marca del Equipo', model: 'Modelo del Equipo', condition: 'Estado del Equipo', seasons: 'Temporadas de uso del Equipo', desc: 'Descripción extra del Equipo (opcional)' },
    otros:             { brand: 'Otros Marca', model: 'Otros Modelo', condition: 'Otros Estado', seasons: null, desc: 'Otros Descripción extra (opcional)' },
  }

  const map = brandModelMap[type]
  if (!map) return null

  return {
    brand: strVal(row[map.brand]) || 'Sin marca',
    model: strVal(row[map.model]),
    condition: mapCondition(row[map.condition]),
    seasons_used: map.seasons ? strVal(row[map.seasons]) : null,
    description: strVal(row[map.desc]),
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const excelPath = join(__dirname, 'productos.xlsx')
  console.log(`\n📂 Leyendo Excel: ${excelPath}`)

  let workbook
  try {
    workbook = xlsx.readFile(excelPath)
  } catch {
    console.error('❌ No se encontró scripts/productos.xlsx')
    process.exit(1)
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' })
  console.log(`✅ ${rows.length} filas en Excel\n`)

  // ── Paso 1: Borrar todos los productos existentes ──
  console.log('🗑️  Borrando productos existentes...')
  const { error: delImgErr } = await supabase.from('product_images').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (delImgErr) console.warn('   Aviso borrando imágenes:', delImgErr.message)

  const { error: delErr, count } = await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (delErr) {
    console.error('❌ Error borrando productos:', delErr.message)
    process.exit(1)
  }
  console.log('   ✅ Productos borrados\n')

  // ── Paso 2: Cachear usuarios existentes ──
  console.log('👥 Cargando usuarios...')
  const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const userCache = {}
  if (existingUsers?.users) {
    for (const u of existingUsers.users) {
      if (u.email) userCache[u.email.toLowerCase()] = u.id
    }
  }
  console.log(`   ${Object.keys(userCache).length} usuarios en auth\n`)

  // ── Paso 3: Importar ──
  let created = 0
  let skipped = 0
  let errors = 0
  const errorDetails = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2

    const email = strVal(row['Email Address'])
    const name = strVal(row['Nombre y apellido'])
    const phone = strVal(row['Número de teléfono de contacto'])
    const instagram = strVal(row['Usuario de Instagram'])
    const region = strVal(row['Región'])
    const comuna = strVal(row['Comuna'])
    const priceRaw = row['Precio']
    const price = numVal(priceRaw)
    const productTypeRaw = strVal(row['Selecciona el tipo de producto que deseas vender'])

    // Validaciones
    if (!email) {
      console.warn(`⚠️  Fila ${rowNum}: sin email, saltando`)
      errorDetails.push({ row: rowNum, reason: 'Sin email' })
      skipped++
      continue
    }
    if (!productTypeRaw) {
      console.warn(`⚠️  Fila ${rowNum}: sin tipo de producto, saltando`)
      errorDetails.push({ row: rowNum, email, reason: 'Sin tipo de producto' })
      skipped++
      continue
    }
    if (!price || price <= 0) {
      console.warn(`⚠️  Fila ${rowNum}: precio inválido (${priceRaw}), saltando`)
      errorDetails.push({ row: rowNum, email, reason: `Precio inválido: ${priceRaw}` })
      skipped++
      continue
    }

    const productType = mapProductType(productTypeRaw)
    if (!productType) {
      console.warn(`⚠️  Fila ${rowNum}: tipo desconocido "${productTypeRaw}", saltando`)
      errorDetails.push({ row: rowNum, email, reason: `Tipo desconocido: ${productTypeRaw}` })
      skipped++
      continue
    }

    // ── Obtener o crear usuario ──
    const emailLower = email.toLowerCase()
    let userId = userCache[emailLower]

    if (!userId) {
      // Crea usuario en auth
      const tempPassword = Math.random().toString(36).slice(-10) + 'A1!'
      const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
        email: emailLower,
        password: tempPassword,
        email_confirm: true,
      })
      if (authError) {
        console.error(`❌ Fila ${rowNum}: error creando auth user ${email}: ${authError.message}`)
        errorDetails.push({ row: rowNum, email, reason: `Auth error: ${authError.message}` })
        errors++
        continue
      }
      userId = newUser.user.id
      userCache[emailLower] = userId
    }

    // Upsert en tabla users
    await supabase.from('users').upsert({
      id: userId,
      email: emailLower,
      name: name || null,
      phone: phone || null,
      instagram: instagram ? instagram.replace(/^@/, '') : null,
    }, { onConflict: 'id', ignoreDuplicates: false })

    // ── Extraer campos del producto ──
    const fields = extractProductFields(productType, row)
    if (!fields) {
      console.warn(`⚠️  Fila ${rowNum}: no se pudieron extraer campos para tipo ${productType}`)
      errorDetails.push({ row: rowNum, email, reason: `Sin campos para tipo ${productType}` })
      skipped++
      continue
    }

    // Validar que al menos tenga marca
    if (fields.brand === 'Sin marca' && !fields.model) {
      console.warn(`⚠️  Fila ${rowNum}: sin marca ni modelo para ${productType}, saltando`)
      errorDetails.push({ row: rowNum, email, type: productType, reason: 'Sin marca ni modelo' })
      skipped++
      continue
    }

    const attributes = extractAttributes(productType, row)

    // ── Insertar producto ──
    const { error: productError } = await supabase.from('products').insert({
      seller_id: userId,
      product_type: productType,
      brand: fields.brand,
      model: fields.model,
      condition: fields.condition || 'usado_buen_estado',
      seasons_used: fields.seasons_used,
      description: fields.description,
      price,
      region: region || 'Metropolitana',
      comuna: comuna || '',
      attributes,
      status: 'approved',
      terms_accepted: true,
    })

    if (productError) {
      console.error(`❌ Fila ${rowNum}: error insertando: ${productError.message}`)
      errorDetails.push({ row: rowNum, email, brand: fields.brand, model: fields.model, reason: productError.message })
      errors++
    } else {
      console.log(`✅ Fila ${rowNum}: ${productType} - ${fields.brand} ${fields.model || ''} ($${price?.toLocaleString('es-CL')}) [${email}]`)
      created++
    }
  }

  // ── Reporte final ──
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RESULTADO DE RE-IMPORTACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📊 Filas en Excel:  ${rows.length}
  ✅ Importados:      ${created}
  ⚠️  Saltados:       ${skipped}
  ❌ Errores:         ${errors}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  if (errorDetails.length > 0) {
    console.log('\n📋 Detalle de problemas:')
    errorDetails.forEach(d => {
      console.log(`   Fila ${d.row}: ${d.reason} ${d.email ? `(${d.email})` : ''} ${d.brand ? `- ${d.brand} ${d.model || ''}` : ''}`)
    })
  }

  // Verificación final
  const { data: finalCount } = await supabase.from('products').select('id', { count: 'exact', head: true })
  console.log(`\n🔢 Productos en BD después de importación: consulta la tabla para verificar`)
}

main().catch(console.error)
