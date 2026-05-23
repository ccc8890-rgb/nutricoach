/**
 * rematch-ingredientes-auto.ts — Script de rematch masivo de ingredientes huérfanos
 *
 * Ejecuta el pipeline de 3 fases sobre TODOS los ingredientes sin alimento_id:
 *   FASE 1: Match contra alimentos existentes (por nombre, ILIKE, fuzzy)
 *   FASE 2: Match contra productos_supermercado (precios incluidos)
 *   FASE 3: Crear nuevo alimento vía DeepSeek con datos BEDCA/USDA verificables
 *
 * Uso:
 *   npx tsx scripts/rematch-ingredientes-auto.ts
 *   npx tsx scripts/rematch-ingredientes-auto.ts --dry-run   (solo diagnóstico)
 *   npx tsx scripts/rematch-ingredientes-auto.ts --receta-id <uuid>  (una receta)
 *
 * @module scripts/rematch-ingredientes-auto
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── Cargar variables de entorno ───────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_LOCAL = resolve(__dirname, '..', '.env.local')

function loadEnvLocal() {
  if (!existsSync(ENV_LOCAL)) {
    console.error(`❌ No se encuentra .env.local en ${ENV_LOCAL}`)
    process.exit(1)
  }
  const lines = readFileSync(ENV_LOCAL, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    // Quitar comillas si existen
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan SUPABASE_URL o SUPABASE_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

// ── Args ──────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const RECETA_ID = args.includes('--receta-id')
  ? args[args.indexOf('--receta-id') + 1]
  : undefined

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('🧩 REMATCH AUTOMÁTICO DE INGREDIENTES HUÉRFANOS\n')
  console.log(`   Dry-run: ${DRY_RUN ? '✅ SÍ (solo diagnóstico)' : '❌ NO (ejecutará cambios)'}`)
  if (RECETA_ID) console.log(`   Receta específica: ${RECETA_ID}`)
  console.log('')

  // 1. Contar huérfanos actuales
  const { data: orphans, error: e0, count: totalCount } = await supabase
    .from('receta_ingredientes')
    .select('id, receta_id, nombre_libre, cantidad_gramos', DRY_RUN ? { count: 'exact' } : undefined)
    .is('alimento_id', null)
    .order('nombre_libre')

  if (e0) {
    console.error(`❌ Error consultando huérfanos: ${e0.message}`)
    process.exit(1)
  }

  if (!orphans || orphans.length === 0) {
    console.log('✅ No hay ingredientes huérfanos. Todo correcto.')
    return
  }

  console.log(`📊 TOTAL: ${orphans.length} ingredientes huérfanos\n`)

  // Agrupar por nombre_libre para diagnóstico
  const grupos = new Map<string, typeof orphans>()
  for (const o of orphans) {
    const key = (o.nombre_libre || '').toLowerCase().trim()
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(o)
  }

  // Diagnóstico: mostrar todos los nombres únicos
  console.log('━━━ NOMBRES ÚNICOS A PROCESAR ━━━')
  const sorted = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length)
  for (const [nombre, records] of sorted) {
    const cant = records[0].cantidad_gramos
    const recetasIds = [...new Set(records.map(r => r.receta_id))]
    const nombreOrig = records[0].nombre_libre
    console.log(`  ${nombreOrig} (${cant}g, ${records.length} ocurrencia(s), ${recetasIds.length} receta(s))`)
  }
  console.log('')

  // Si es dry-run, terminar aquí
  if (DRY_RUN) {
    console.log('🔍 Dry-run completado. Pasa --dry-run para ver este diagnóstico.')
    console.log('   Ejecuta sin --dry-run para procesar los huérfanos.')
    return
  }

  // 2. Ejecutar pipeline de auto-match
  console.log('━━━ EJECUTANDO PIPELINE DE AUTO-MATCH ━━━\n')

  const { procesarIngredientesHuerfanos } = await import('../lib/recetas/auto-match-ingrediente.ts')

  const resultado = await procesarIngredientesHuerfanos(
    supabase,
    RECETA_ID ? [RECETA_ID] : undefined
  )

  // 3. Resumen final
  console.log('\n━━━ RESUMEN FINAL ━━━')
  console.log(`   Total procesados:    ${resultado.total}`)
  console.log(`   Match existente:     ${resultado.match_existente}`)
  console.log(`   Match supermercado:  ${resultado.match_producto}`)
  console.log(`   Creado nuevo (IA):   ${resultado.creado_nuevo}`)
  console.log(`   Sin match:           ${resultado.sin_match}`)
  console.log(`   Recetas recalc:      ${resultado.recetas_recalculadas}`)
  console.log(`   Errores:             ${resultado.errores.length}`)

  if (resultado.errores.length > 0) {
    console.log('\n⚠️  ERRORES:')
    for (const err of resultado.errores) {
      console.log(`   - ${err}`)
    }
  }

  if (resultado.sin_match > 0) {
    console.log(`\n⚠️  Quedan ${resultado.sin_match} ingredientes sin match. Revisa los detalles.`)
  }

  // 4. Mostrar detalle por ingrediente
  console.log('\n━━━ DETALLE POR INGREDIENTE ━━━')
  for (const d of resultado.detalle) {
    const icono = d.estado === 'match_existente' ? '✅' :
      d.estado === 'match_producto' ? '🛒' :
        d.estado === 'creado_nuevo' ? '🤖' : '❌'
    console.log(`  ${icono} "${d.nombre_libre}" → ${d.alimento_nombre ?? 'SIN MATCH'} (${d.confianza})`)
  }

  console.log('\n✅ Proceso completado.')
}

main().catch(err => {
  console.error('❌ Error fatal:', err)
  process.exit(1)
})
