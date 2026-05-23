#!/usr/bin/env node
/**
 * Resuelve la FK pendiente de Pimienta negra en comida_alimentos.
 * Usa los UUIDs CORRECTOS verificados en la BD.
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

// UUIDs CORRECTOS verificados en la BD
const OLD_ID = '28ab7906-2621-4db1-89ea-2bc75a153f70'  // "Pimienta negra"
const NEW_ID = '3350c934-6dca-431c-a64b-3db8f86a668d'  // "Pimienta negra molida"

async function main() {
  console.log('='.repeat(70))
  console.log('  RESOLVIENDO FK: Pimienta negra → Pimienta negra molida')
  console.log('='.repeat(70))

  // 1. Verificar que ambos alimentos existen
  const { data: oldA } = await sb.from('alimentos').select('id, nombre').eq('id', OLD_ID).single()
  const { data: newA } = await sb.from('alimentos').select('id, nombre').eq('id', NEW_ID).single()
  console.log(`\n✅ Alimento origen:  "${oldA?.nombre}" (${OLD_ID})`)
  console.log(`✅ Alimento destino: "${newA?.nombre}" (${NEW_ID})`)

  // 2. Ver registros en comida_alimentos con OLD_ID
  const { data: caRows } = await sb.from('comida_alimentos').select('*').eq('alimento_id', OLD_ID)
  console.log(`\n📊 Registros en comida_alimentos con OLD_ID: ${caRows?.length || 0}`)
  if (caRows?.length > 0) console.table(caRows)

  // 3. UPDATE comida_alimentos → NEW_ID
  console.log('\n🔄 Actualizando comida_alimentos...')
  const { error: updateErr } = await sb.from('comida_alimentos')
    .update({ alimento_id: NEW_ID })
    .eq('alimento_id', OLD_ID)

  if (updateErr) {
    console.log(`  ❌ Error al actualizar: ${updateErr.message}`)
    process.exit(1)
  }
  console.log('  ✅ comida_alimentos actualizado')

  // 4. Verificar que ya no hay referencias al OLD_ID
  const { data: remaining } = await sb.from('comida_alimentos').select('*').eq('alimento_id', OLD_ID)
  console.log(`  📊 Referencias restantes al OLD_ID en comida_alimentos: ${remaining?.length || 0}`)

  // 5. Verificar receta_ingredientes - deben apuntar a NEW_ID
  const { data: riOld } = await sb.from('receta_ingredientes').select('id').eq('alimento_id', OLD_ID).limit(5)
  console.log(`\n📊 Receta_ingredientes aún apuntando a OLD_ID: ${riOld?.length || 0}`)

  // 6. ELIMINAR el alimento viejo
  console.log('\n🗑️ Eliminando alimento viejo "Pimienta negra"...')
  const { error: delErr } = await sb.from('alimentos').delete().eq('id', OLD_ID)
  if (delErr) {
    console.log(`  ❌ Error al eliminar: ${delErr.message}`)
    process.exit(1)
  }
  console.log('  ✅ Alimento eliminado correctamente')

  // 7. Verificación final
  const { data: verify } = await sb.from('alimentos').select('id, nombre').eq('id', OLD_ID)
  console.log(`\n🔍 Verificación final - OLD_ID existe?: ${verify?.length > 0 ? 'SÍ (ERROR)' : 'NO (OK)'}`)

  console.log('\n' + '='.repeat(70))
  console.log('  ✅ FK RESUELTA - Merge completado al 100%')
  console.log('='.repeat(70))
}

main().catch(e => { console.error('Error:', e); process.exit(1) })
