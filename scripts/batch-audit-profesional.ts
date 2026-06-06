import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { createClient } from '@supabase/supabase-js'
import { auditarRecetaProfesional } from '../lib/recetas/auditoria'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function main() {
  const DRY = !process.argv.includes('--apply')

  const pageSize = 50
  let from = 0
  let auditadas = 0
  let errores = 0

  // Pre-count para mostrar progreso N/total
  const { count, error: countError } = await supabase
    .from('recetas')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'aprobada')
    .is('score_calidad', null)

  if (countError) {
    console.error('Error contando recetas:', countError.message)
    return
  }

  const grandTotal = count ?? 0

  console.log(DRY ? `[DRY-RUN] No se aplicarán cambios. Usa --apply para ejecutar.` : `[APPLY] Auditando recetas...`)

  while (true) {
    const rangeFrom = DRY ? from : 0
    const { data: recetas, error } = await supabase
      .from('recetas')
      .select('id, nombre, score_calidad')
      .eq('estado', 'aprobada')
      .is('score_calidad', null)
      .range(rangeFrom, rangeFrom + pageSize - 1)

    if (error) {
      console.error('Error fetching recetas:', error.message)
      break
    }

    if (!recetas || recetas.length === 0) break

    if (!DRY) {
      for (const r of recetas) {
        try {
          const resultado = await auditarRecetaProfesional(supabase, r.id)
          auditadas++
          process.stdout.write(`  [${auditadas}/${grandTotal}] ✓ ${r.nombre} → score ${resultado.score.score ?? '?'}\n`)
        } catch (err) {
          errores++
          console.error(`  ✗ ${r.nombre}:`, err instanceof Error ? err.message : err)
        }
      }
    } else {
      for (const r of recetas) {
        console.log(`  · ${r.nombre} (score_calidad: null)`)
      }
    }

    if (recetas.length < pageSize) break
    if (DRY) from += pageSize
  }

  console.log(`\n─────────────────────────────`)
  if (DRY) {
    console.log(`Total sin score: ${grandTotal}. Ejecuta con --apply para auditar.`)
  } else {
    console.log(`Auditadas: ${auditadas}/${grandTotal} | Errores: ${errores}`)
  }
}

main().catch(console.error)
