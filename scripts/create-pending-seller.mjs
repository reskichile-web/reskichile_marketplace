/**
 * Crea/reutiliza un vendedor pendiente, mueve productos a su cuenta y genera
 * un link para definir contraseña.
 *
 * Ejemplo:
 *   node scripts/create-pending-seller.mjs \
 *     --email vendedor@example.com \
 *     --name "Nombre Vendedor" \
 *     --phone "+56912345678" \
 *     --instagram "@usuario" \
 *     --products "slug-1,550e8400-e29b-41d4-a716-446655440000"
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { randomBytes } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SLUG_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const DEFAULT_SOURCE_EMAIL = 'reskichile@gmail.com'
const DEFAULT_SITE_URL = 'https://reskichile.cl'

function parseEnvFile(path) {
  const env = {}
  try {
    readFileSync(path, 'utf-8').split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const [key, ...value] = trimmed.split('=')
      if (key && value.length) env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '')
    })
  } catch {
    console.error('No se encontró .env.local')
    process.exit(1)
  }
  return env
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
    } else {
      args[key] = next
      i++
    }
  }
  return args
}

function required(args, key) {
  const value = String(args[key] || '').trim()
  if (!value) {
    console.error(`Falta --${key}`)
    process.exit(1)
  }
  return value
}

function generateInviteSlug(length = 8) {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length]
  return out
}

function generateTempPassword() {
  return `${randomBytes(18).toString('base64url')}A1`
}

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

function normalizeInstagram(value) {
  const trimmed = String(value || '').trim()
  return trimmed ? trimmed.replace(/^@/, '') : null
}

function looksLikeUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function getOrCreateUser({ supabase, email, name, phone, instagram }) {
  const { data: existing, error: lookupError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle()

  if (lookupError) throw new Error(`Error buscando usuario: ${lookupError.message}`)

  let userId = existing?.id
  let created = false

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: generateTempPassword(),
      email_confirm: true,
    })
    if (error) throw new Error(`Error creando auth user ${email}: ${error.message}`)
    userId = data.user.id
    created = true
  }

  const profile = {
    id: userId,
    email,
    name: name || null,
    phone: phone || null,
    instagram: normalizeInstagram(instagram),
    must_change_password: true,
    keep: true,
  }

  const { error: upsertError } = await supabase
    .from('users')
    .upsert(profile, { onConflict: 'id', ignoreDuplicates: false })

  if (upsertError) throw new Error(`Error guardando perfil ${email}: ${upsertError.message}`)

  return { userId, created }
}

async function getUserIdByEmail(supabase, email) {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (error) throw new Error(`Error buscando ${email}: ${error.message}`)
  return data?.id || null
}

async function findProducts(supabase, identifiers) {
  const ids = identifiers.filter(looksLikeUuid)
  const slugs = identifiers.filter((v) => !looksLikeUuid(v))
  const found = []

  if (ids.length) {
    const { data, error } = await supabase
      .from('products')
      .select('id, slug, brand, model, seller_id')
      .in('id', ids)
    if (error) throw new Error(`Error buscando productos por id: ${error.message}`)
    found.push(...(data || []))
  }

  if (slugs.length) {
    const { data, error } = await supabase
      .from('products')
      .select('id, slug, brand, model, seller_id')
      .in('slug', slugs)
    if (error) throw new Error(`Error buscando productos por slug: ${error.message}`)
    found.push(...(data || []))
  }

  const foundKeys = new Set(found.flatMap((p) => [p.id, p.slug].filter(Boolean)))
  const missing = identifiers.filter((value) => !foundKeys.has(value))
  if (missing.length) throw new Error(`Productos no encontrados: ${missing.join(', ')}`)

  return found
}

async function moveProducts({ supabase, products, targetUserId, sourceUserId, allowAnySource }) {
  if (!products.length) return { moved: [] }

  if (!allowAnySource) {
    const wrongOwner = products.filter((p) => p.seller_id !== sourceUserId)
    if (wrongOwner.length) {
      const names = wrongOwner.map((p) => p.slug || p.id).join(', ')
      throw new Error(`Estos productos no pertenecen al usuario fuente: ${names}`)
    }
  }

  const productIds = products.map((p) => p.id)
  const { error } = await supabase
    .from('products')
    .update({ seller_id: targetUserId })
    .in('id', productIds)

  if (error) throw new Error(`Error moviendo productos: ${error.message}`)
  return { moved: products }
}

async function createInvite(supabase, userId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateInviteSlug(8)
    const { error } = await supabase
      .from('password_invites')
      .insert({ slug, user_id: userId })
    if (!error) return slug
    if (attempt === 4) throw new Error(`Error creando invitación: ${error.message}`)
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const email = normalizeEmail(required(args, 'email'))
  const name = String(args.name || '').trim()
  const phone = String(args.phone || '').trim()
  const instagram = String(args.instagram || '').trim()
  const productList = String(args.products || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  const sourceEmail = normalizeEmail(String(args['from-email'] || DEFAULT_SOURCE_EMAIL))
  const allowAnySource = Boolean(args['allow-any-source'])

  if (!productList.length) {
    console.error('Falta --products con ids o slugs separados por coma')
    process.exit(1)
  }

  const env = parseEnvFile(join(__dirname, '../.env.local'))
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  const siteUrl = env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const sourceUserId = allowAnySource ? null : await getUserIdByEmail(supabase, sourceEmail)
  if (!allowAnySource && !sourceUserId) {
    throw new Error(`No existe el usuario fuente ${sourceEmail}`)
  }

  const { userId, created } = await getOrCreateUser({
    supabase,
    email,
    name,
    phone,
    instagram,
  })
  const products = await findProducts(supabase, productList)
  const { moved } = await moveProducts({
    supabase,
    products,
    targetUserId: userId,
    sourceUserId,
    allowAnySource,
  })
  const inviteSlug = await createInvite(supabase, userId)

  console.log('\nUsuario pendiente listo')
  console.log(`Email: ${email}`)
  console.log(`Usuario: ${created ? 'creado' : 'existente'} (${userId})`)
  console.log(`Productos movidos: ${moved.length}`)
  moved.forEach((p) => console.log(`- ${p.brand} ${p.model || ''} (${p.slug || p.id})`))
  console.log(`Link: ${siteUrl.replace(/\/$/, '')}/i/${inviteSlug}`)
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`)
  process.exit(1)
})
