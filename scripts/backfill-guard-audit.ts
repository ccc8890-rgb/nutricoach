/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🛡️ BACKFILL — Actualiza es_comestible=false en BD para productos
 *               no comestibles, usando el guard REAL (único punto de verdad)
 *
 * Uso: npx tsx scripts/backfill-guard-audit.ts [--dry-run]
 * ═══════════════════════════════════════════════════════════════════════
 */
import { createClient } from '@supabase/supabase-js'
import { esProductoNoComestible } from '../lib/scraping/guard-no-comestible'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const DRY_RUN = process.argv.includes('--dry-run')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  let offset = 0
  const LIMIT = 500
  let total = 0
  let actualizados = 0
  let sinCambios = 0
  const idsActualizar: string[] = []

  console.log(`\n🔍 Escaneando BD en lotes de ${LIMIT}...`)
  if (DRY_RUN) console.log('   ⚠️  MODO DRY-RUN — NO se actualizará la BD\n')
  else console.log('   ⚠️  MODO REAL — Se actualizarán los registros\n')

  while (true) {
    const { data, error } = await supabase
      .from('alimentos')
      .select('id, nombre, es_comestible')
      .range(offset, offset + LIMIT - 1)

    if (error) { console.error('Error query:', error); break }
    if (!data || data.length === 0) break

    for (const row of data) {
      total++
      const noComestible = esProductoNoComestible(row.nombre)

      if (noComestible && row.es_comestible !== false) {
        // Producto no comestible pero BD dice que sí — actualizar
        idsActualizar.push(row.id)
        actualizados++
      } else if (noComestible && row.es_comestible === false) {
        sinCambios++
      }
    }

    offset += LIMIT
    if (data.length < LIMIT) break
    process.stdout.write(`   ...${total} escaneados, ${actualizados} pendientes\r`)
  }

  console.log(`\n📊 Total escaneados: ${total}`)
  console.log(`   ⏭️  Ya marcados no-comestibles: ${sinCambios}`)
  console.log(`   🔴 Necesitan actualización: ${actualizados}`)

  if (actualizados > 0 && !DRY_RUN) {
    console.log(`\n💾 Actualizando ${actualizados} registros...`)
    // Actualizar en lotes de 100
    const BATCH_SIZE = 100
    for (let i = 0; i < idsActualizar.length; i += BATCH_SIZE) {
      const batch = idsActualizar.slice(i, i + BATCH_SIZE)
      const { data: res, error } = await supabase
        .from('alimentos')
        .update({ es_comestible: false })
        .in('id', batch)
        .select('id, nombre')
      if (error) console.error(`   Error lote ${i}: ${error.message}`)
      else process.stdout.write(`   ...${Math.min(i + BATCH_SIZE, actualizados)}/${actualizados}\r`)
    }
    console.log(`\n✅ ${actualizados} productos marcados como no comestibles`)
  }

  if (DRY_RUN) {
    console.log('\n📋 Productos que se actualizarían:')
    const { data: dryData } = await supabase
      .from('alimentos')
      .select('id, nombre')
      .in('id', idsActualizar.slice(0, 50))
    if (dryData) {
      for (const p of dryData) {
        console.log(`   - ${p.nombre} (${p.id.slice(0, 8)}...)`)
      }
      if (idsActualizar.length > 50) {
        console.log(`   ... y ${idsActualizar.length - 50} más`)
      }
    }
  }
}

run().catch(console.error)
