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

const { count } = await supabase.from('sales_history').select('*', { count: 'exact', head: true })
console.log(`Filas encontradas: ${count}`)

const { error } = await supabase.from('sales_history').delete().neq('id', '00000000-0000-0000-0000-000000000000')

if (error) {
  console.error('Error al borrar filas:', error.message)
} else {
  console.log(`✅ Todas las filas eliminadas.`)
}
