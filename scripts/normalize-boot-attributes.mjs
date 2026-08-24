#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const apply = process.argv.includes('--apply')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const EXPLICIT_MONDO = new Map([
  // Burton Limelight: el valor anterior era US mujer 10.
  ['3859db4a-4fc8-424e-8d6d-4eff1e00e493', '27/27.5'],
])

const KNOWN_BOA = new Set([
  '4b1bf290-e837-4b60-bae0-e656910408f7', // K2 BFC 120 BOA
  '31b20721-cfa7-49e6-aaf3-31b477ea2742', // K2 Raider BOA
  '4634d1d5-70ab-4f0f-84d9-211d036f6273', // Burton Photon Step On
  '3859db4a-4fc8-424e-8d6d-4eff1e00e493', // Burton Limelight Step On
  '284de952-4698-4ae2-b137-1b3f2445dd02', // Head BOA Six50
])

const KNOWN_BSL = new Map([
  ['0038b177-be0e-4e03-aa1e-81507a19318b', '326'],
  ['d66e9ed7-454d-40c1-b811-def64c74bf99', '266'],
])

function mondoBand(value) {
  if (value == null) return null
  const numbers = String(value).replaceAll(',', '.').match(/\d+(?:\.\d+)?/g)?.map(Number) || []
  const mondo = numbers.find(number => number >= 18 && number <= 33.5)
  if (mondo == null) return null
  const rounded = Math.round(mondo * 2) / 2
  const base = Math.floor(rounded)
  return `${base}/${base}.5`
}

function normalizedFlex(value) {
  if (value == null) return null
  const numbers = String(value).replaceAll(',', '.').match(/\d+(?:\.\d+)?/g)?.map(Number) || []
  if (!numbers.length) return null
  return String(Math.round((numbers.reduce((sum, number) => sum + number, 0) / numbers.length) / 5) * 5)
}

function normalizeAttributes(product) {
  const current = { ...(product.attributes || {}) }
  const explicit = EXPLICIT_MONDO.get(product.id)
  const mondo = explicit || mondoBand(current.talla_mondo) || mondoBand(current.talla_cm)
  if (!mondo) throw new Error(`No se pudo normalizar la talla de ${product.id} (${product.brand} ${product.model || ''})`)

  delete current.talla_cm
  current.talla_mondo = mondo
  current.boa = KNOWN_BOA.has(product.id)

  const flex = normalizedFlex(current.flex)
  if (flex) current.flex = flex

  if (Array.isArray(current.genero) && current.genero.includes('hombre') && current.genero.includes('mujer')) {
    current.genero = ['unisex']
  }

  const bsl = KNOWN_BSL.get(product.id)
  if (bsl) current.largo_suela_mm = bsl

  return current
}

const { data: products, error } = await supabase
  .from('products')
  .select('id, product_type, brand, model, attributes')
  .in('product_type', ['botas_esqui', 'botas_snowboard'])
  .order('product_type')

if (error) throw error

const changes = products.map(product => ({
  product,
  next: normalizeAttributes(product),
})).filter(({ product, next }) => JSON.stringify(product.attributes || {}) !== JSON.stringify(next))

console.log(`${changes.length} botas requieren normalización.`)
for (const { product, next } of changes) {
  console.log(`${product.id} | ${product.brand} ${product.model || ''}`)
  console.log(`  ${JSON.stringify(product.attributes || {})}`)
  console.log(`  ${JSON.stringify(next)}`)
}

if (!apply) {
  console.log('\nVista previa solamente. Usa --apply para guardar.')
  process.exit(0)
}

for (const { product, next } of changes) {
  const { error: updateError } = await supabase
    .from('products')
    .update({ attributes: next })
    .eq('id', product.id)
  if (updateError) throw new Error(`${product.id}: ${updateError.message}`)
}

console.log(`\n${changes.length} botas normalizadas correctamente.`)
