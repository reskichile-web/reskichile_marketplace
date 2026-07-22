/**
 * Load test for Supabase signup rate limit.
 *
 * Crea N signups en paralelo usando aliases del email base
 * (ej: tucorreo+rsk1@gmail.com, +rsk2, ...).
 * Reporta éxitos, 429 (rate limit), y otros errores.
 *
 * Uso:
 *   node scripts/load-test-signup.mjs tucorreo@gmail.com 10
 *   node scripts/load-test-signup.mjs tucorreo@gmail.com 10 --cleanup
 *
 * --cleanup borra los auth.users de prueba después (requiere SUPABASE_SERVICE_ROLE_KEY).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '../.env.local')
const env = {}
readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && v.length) env[k.trim()] = v.join('=').trim()
})

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const ANON_KEY = env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
const SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local')
  process.exit(1)
}

const args = process.argv.slice(2)
const baseEmail = args[0]
const count = parseInt(args[1] || '10', 10)
const cleanup = args.includes('--cleanup')

if (!baseEmail || !baseEmail.includes('@')) {
  console.error('Uso: node scripts/load-test-signup.mjs tucorreo@gmail.com [count] [--cleanup]')
  process.exit(1)
}

const [user, domain] = baseEmail.split('@')
const stamp = Date.now().toString(36)
const emails = Array.from({ length: count }, (_, i) => `${user}+rsk${stamp}${i + 1}@${domain}`)

const anon = createClient(SUPABASE_URL, ANON_KEY)

console.log(`\n→ Disparando ${count} signups en paralelo contra ${SUPABASE_URL}`)
console.log(`→ Base: ${baseEmail} (aliases: +rsk${stamp}1 .. +rsk${stamp}${count})\n`)

const t0 = Date.now()
const results = await Promise.allSettled(
  emails.map(email =>
    anon.auth.signUp({
      email,
      password: 'TestPass123',
      options: {
        emailRedirectTo: 'https://reskichile.cl/auth/callback',
        data: { name: email.split('@')[0] },
      },
    }).then(({ data, error }) => ({ email, data, error }))
  )
)
const elapsed = Date.now() - t0

let ok = 0, rateLimited = 0, otherErr = 0
for (const r of results) {
  if (r.status === 'rejected') {
    otherErr++
    console.log(`  ✗ rejected: ${r.reason?.message || r.reason}`)
    continue
  }
  const { email, data, error } = r.value
  if (error) {
    const msg = (error.message || '').toLowerCase()
    if (error.status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
      rateLimited++
      console.log(`  ⛔ 429  ${email}  → ${error.message}`)
    } else {
      otherErr++
      console.log(`  ✗ err  ${email}  → ${error.status} ${error.message}`)
    }
  } else {
    ok++
    console.log(`  ✓ 200  ${email}  → user_id=${data.user?.id?.slice(0, 8)}…`)
  }
}

console.log(`\n──── Resumen (${elapsed}ms) ────`)
console.log(`  OK            : ${ok}/${count}`)
console.log(`  Rate limited  : ${rateLimited}/${count}`)
console.log(`  Other errors  : ${otherErr}/${count}`)
console.log(`\nRevisa Resend → Emails para ver entregas, y tu inbox de Gmail para los códigos.\n`)

if (cleanup) {
  if (!SERVICE_KEY) {
    console.error('No se puede limpiar: falta SUPABASE_SERVICE_ROLE_KEY en .env.local')
    process.exit(1)
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  console.log('→ Limpiando auth.users de prueba...')
  let deleted = 0
  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    const id = r.value.data?.user?.id
    if (!id) continue
    const { error } = await admin.auth.admin.deleteUser(id)
    if (!error) deleted++
    else console.log(`  ✗ no se pudo borrar ${id}: ${error.message}`)
  }
  console.log(`→ Borrados ${deleted}/${count}\n`)
}
