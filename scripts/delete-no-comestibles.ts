/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🗑️ DELETE — Elimina COMPLETAMENTE de la BD todos los productos
 *             no comestibles (cosmética, limpieza, alcohol, mascotas,
 *             farmacia, etc.) que no deberían estar en la BD.
 *
 * Estos productos entran por scraping de supermercados y no aportan
 * nada a la app de nutrición — solo generan ruido, fallos en vistas
 * y confusión en el UI.
 *
 * Orden de borrado (respetando FKs):
 *   1. precios_historico       (ON DELETE CASCADE)
 *   2. productos_supermercado  (ON DELETE CASCADE)
 *   3. alimentos_enriquecimiento_cola (ON DELETE CASCADE)
 *   4. alimentos_nutricion_audit (ON DELETE CASCADE)
 *   5. lista_compra_items      (ON DELETE CASCADE)
 *   6. comida_alimentos        (ON DELETE RESTRICT — aborta si hay refs)
 *   7. receta_ingredientes     (NO ACTION — aborta si hay refs)
 *   8. alimentos               (¡target!)
 *
 * Uso: npx tsx scripts/delete-no-comestibles.ts [--dry-run]
 *        --dry-run  : solo muestra lo que se borraría, sin ejecutar
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

interface RowInfo {
  id: string
  nombre: string
  categoria: string | null
}

async function run() {
  console.log('')
  console.log('='.repeat(65))
  console.log('  DELETE NO-COMESTIBLES — Eliminación completa de BD')
  console.log('='.repeat(65))
  console.log('')
  if (DRY_RUN) console.log('  MODO DRY-RUN — NO se borrará nada\n')

  // ── Paso 1: Escanear y recolectar IDs ───────────────────────
  let offset = 0
  const LIMIT = 1000
  let total = 0
  const idsNoComestibles: RowInfo[] = []

  console.log('Escaneando tabla alimentos...')

  while (true) {
    const { data, error } = await supabase
      .from('alimentos')
      .select('id, nombre, categoria')
      .range(offset, offset + LIMIT - 1)

    if (error) { console.error('Error:', error); return }
    if (!data || data.length === 0) break

    for (const row of data) {
      total++
      if (esProductoNoComestible(row.nombre)) {
        idsNoComestibles.push({ id: row.id, nombre: row.nombre, categoria: row.categoria })
      }
    }

    offset += LIMIT
    console.log(`  ${total} escaneados... (${idsNoComestibles.length} no comestibles)`)
  }

  console.log(`\nTOTAL: ${total} alimentos, ${idsNoComestibles.length} no comestibles\n`)

  if (idsNoComestibles.length === 0) {
    console.log('Nada que eliminar.')
    return
  }

  // ── Paso 2: Consultar referencias en lote ───────────────────
  const ids = idsNoComestibles.map(r => r.id)

  console.log('Consultando referencias en tablas hijas...')

  const [psRes, phRes, riRes, caRes, ecRes, anRes] = await Promise.all([
    supabase.from('productos_supermercado').select('alimento_id', { count: 'exact', head: true }).in('alimento_id', ids),
    supabase.from('precios_historico').select('alimento_id', { count: 'exact', head: true }).in('alimento_id', ids),
    supabase.from('receta_ingredientes').select('alimento_id', { count: 'exact', head: true }).in('alimento_id', ids),
    supabase.from('comida_alimentos').select('alimento_id', { count: 'exact', head: true }).in('alimento_id', ids),
    supabase.from('alimentos_enriquecimiento_cola').select('alimento_id', { count: 'exact', head: true }).in('alimento_id', ids),
    supabase.from('alimentos_nutricion_audit').select('alimento_id', { count: 'exact', head: true }).in('alimento_id', ids),
  ])
  // lista_compra_items NO existe en esta BD (fue renombrada o nunca creada)
  const lcRes = { count: 0 }

  console.log('')
  console.log('  ┌────────────────────────────────────────────────────────┐')
  console.log('  │                    REFERENCIAS                         │')
  console.log('  ├────────────────────────────────────────────────────────┤')
  console.log(`  │  productos_supermercado:      ${String(psRes.count ?? 0).padStart(31)} │`)
  console.log(`  │  precios_historico:             ${String(phRes.count ?? 0).padStart(31)} │`)
  console.log(`  │  receta_ingredientes:           ${String(riRes.count ?? 0).padStart(31)} │`)
  console.log(`  │  comida_alimentos:              ${String(caRes.count ?? 0).padStart(31)} │`)
  console.log(`  │  lista_compra_items:            ${String(lcRes.count ?? 0).padStart(31)} │`)
  console.log(`  │  alimentos_enriquecimiento_cola: ${String(ecRes.count ?? 0).padStart(31)} │`)
  console.log(`  │  alimentos_nutricion_audit:     ${String(anRes.count ?? 0).padStart(31)} │`)
  console.log('  └────────────────────────────────────────────────────────┘')
  console.log('')

  // NOTA: Las consultas count con .in() sobre 100+ IDs pueden fallar
  // silenciosamente (Bad Request por URL larga). Por seguridad, SIEMPRE
  // intentamos setear NULL en receta_ingredientes y borrar comida_alimentos,
  // incluso si el reporte dice 0.
  const bloqueantes = (riRes.count ?? 0) + (caRes.count ?? 0)
  if (bloqueantes > 0 && !DRY_RUN) {
    console.log(`HAY ${bloqueantes} REFERENCIAS BLOQUEANTES en recetas/comidas.`)
    console.log('NO se puede borrar directamente. Estas referencias significan')
    console.log('que productos no comestibles están siendo usados en planes de')
    console.log('nutrición o recetas — NO deberían estar ahí.')
    console.log('')
    console.log('Posibles acciones:')
    console.log('  1. Ejecuta con --dry-run para ver qué productos están referenciados')
    console.log('  2. Decide si reemplazar esas referencias por NULL o investigar')
    return
  }

  // ── Paso 3: Mostrar productos a eliminar ────────────────────
  console.log('Productos a eliminar:')
  for (const r of idsNoComestibles) {
    console.log(`  ${r.nombre}${r.categoria ? ` (${r.categoria})` : ''}`)
  }
  console.log(`\nTotal: ${idsNoComestibles.length} productos`)

  if (DRY_RUN) {
    console.log('\nDRY-RUN completado. Nada se ha borrado.')
    return
  }

  // ── Helper: borrar por lotes (evita "Bad Request" por URL demasiado larga) ──
  const LOTE = 100
  async function borrarLotes(tabla: string, columna: string, loteIds: string[]) {
    let total = 0
    for (let i = 0; i < loteIds.length; i += LOTE) {
      const lote = loteIds.slice(i, i + LOTE)
      const { error } = await supabase.from(tabla).delete().in(columna, lote)
      if (error) {
        console.error(`  Error borrando ${tabla} (lote ${i}-${i + lote.length}):`, error.message)
        return false
      }
      total += lote.length
    }
    console.log(`  OK ${tabla} (${total})`)
    return true
  }

  console.log('\nBorrando...')

  // Primero tablas con CASCADE (no bloquean)
  const tablasCascade = [
    { name: 'precios_historico', col: 'alimento_id' },
    { name: 'productos_supermercado', col: 'alimento_id' },
    { name: 'alimentos_enriquecimiento_cola', col: 'alimento_id' },
    { name: 'alimentos_nutricion_audit', col: 'alimento_id' },
    { name: 'lista_compra_items', col: 'alimento_id' },
  ]

  for (const t of tablasCascade) {
    await borrarLotes(t.name, t.col, ids)
  }

  // Luego tablas con RESTRICT/NO ACTION (seteamos NULL primero)
  // NOTA: Siempre intentamos aunque el reporte diga 0, porque las queries
  // count con .in() pueden fallar con muchos IDs (URL demasiado larga).
  const loteRI = 50  // lote más pequeño para FK restrictiva
  let totalRI = 0
  let totalCA = 0
  for (let i = 0; i < ids.length; i += loteRI) {
    const lote = ids.slice(i, i + loteRI)

    const { error: errCA } = await supabase.from('comida_alimentos').delete().in('alimento_id', lote)
    if (errCA && !errCA.message.includes('0 rows')) {
      console.error(`  Error comida_alimentos (lote ${i}): ${errCA.message}`)
    } else {
      totalCA += lote.length
    }

    const { error: errRI } = await supabase.from('receta_ingredientes').update({ alimento_id: null }).in('alimento_id', lote)
    if (errRI) {
      console.error(`  Error receta_ingredientes (lote ${i}): ${errRI.message}`)
    } else {
      totalRI += lote.length
    }
  }
  console.log(`  OK comida_alimentos (${totalCA})`)
  console.log(`  OK receta_ingredientes (set NULL, ${totalRI})`)

  // Finalmente alimentos
  const ok = await borrarLotes('alimentos', 'id', ids)
  if (ok) {
    console.log(`\n  ✅ COMPLETADO: ${idsNoComestibles.length} productos eliminados.`)
  } else {
    console.log(`\n  ⚠️  PARCIAL: fallaron algunos lotes.`)
  }
}

run().catch(console.error)
