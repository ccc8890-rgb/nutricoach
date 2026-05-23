#!/usr/bin/env node
/**
 * Investiga la tabla comida_alimentos y la FK de Pimienta negra.
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const envPath = resolve(ROOT, '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const OLD_ID = '28ab7906-2d6b-4c21-9f47-3e87d0d98a5f'
const NEW_ID = '3350c934-1c08-4ce0-a2c9-da3f32a50a43'

async function main() {
  console.log('='.repeat(70))
  console.log('  INVESTIGACIÓN: comida_alimentos + Pimienta negra')
  console.log('='.repeat(70))

  // 1. Estructura: obtener un row para ver columnas
  const { data: sample } = await sb.from('comida_alimentos').select('*').limit(1)
  console.log('\n📋 Columnas de comida_alimentos:')
  if (sample?.[0]) console.log(Object.keys(sample[0]))

  // 2. Todos los registros
  const { data: all } = await sb.from('comida_alimentos').select('*').limit(100)
  console.log(`\n📊 Total registros: ${all?.length || 0}`)
  if (all) console.table(all)

  // 3. Buscar el registro con OLD_ID
  const { data: oldRefs } = await sb.from('comida_alimentos')
    .select('*')
    .eq('alimento_id', OLD_ID)
  console.log(`\n🔍 Registros con OLD_ID (${OLD_ID}): ${oldRefs?.length || 0}`)
  if (oldRefs?.length > 0) console.table(oldRefs)

  // 4. Verificar que NEW_ID existe en alimentos
  const { data: newFood } = await sb.from('alimentos')
    .select('id, nombre')
    .eq('id', NEW_ID)
  console.log(`\n✅ NEW_ID (${NEW_ID}) en alimentos: ${newFood?.[0]?.nombre || 'NO EXISTE'}`)

  // 5. Buscar "Pimienta negra" en alimentos (sin "molida")
  const { data: pimientas } = await sb.from('alimentos')
    .select('id, nombre')
    .or(`nombre.ilike.%Pimienta negra%,nombre.ilike.%pimienta negra%`)
  console.log('\n🌶️ Alimentos con "pimienta negra" (sin molida):')
  if (pimientas) console.table(pimientas)

  // 6. Queries para update manual
  console.log('\n🔄 SQL MANUAL si hace falta:')
  console.log(`\\n-- Opción A: Actualizar comida_alimentos.alimento_id`)
  console.log(`UPDATE comida_alimentos SET alimento_id = '${NEW_ID}' WHERE alimento_id = '${OLD_ID}';`)
  console.log(`\\n-- Opción B: Eliminar el registro de comida_alimentos`)
  console.log(`DELETE FROM comida_alimentos WHERE alimento_id = '${OLD_ID}';`)
  console.log(`\\n-- Opción C: Después, eliminar el alimento viejo`)
  console.log(`DELETE FROM alimentos WHERE id = '${OLD_ID}';`)
}

main().catch(e => { console.error(e); process.exit(1) })
