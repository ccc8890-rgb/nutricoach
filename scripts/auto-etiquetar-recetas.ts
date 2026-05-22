/**
 * Auto-etiqueta todas las recetas aprobadas en BD.
 * Lee ingredientes + nombre y asigna tags basados en lib/auto-tag.ts
 *
 * Uso:
 *   npx tsx scripts/auto-etiquetar-recetas.ts --dry-run   # preview sin escribir
 *   npx tsx scripts/auto-etiquetar-recetas.ts              # aplica en BD
 *   npx tsx scripts/auto-etiquetar-recetas.ts --todas      # incluye en_revision/borrador
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { autoTagReceta } from '../lib/auto-tag'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const dryRun = process.argv.includes('--dry-run')
const todas = process.argv.includes('--todas')
const PAGE_SIZE = 50

;(async () => {
  let page = 0
  let totalVistas = 0
  let totalActualizadas = 0
  const sinTags: string[] = []

  console.log(`\n🏷️  Auto-etiquetado de recetas ${dryRun ? '[DRY RUN — no escribe]' : '[MODO REAL]'}\n`)

  while (true) {
    let query = supabase
      .from('recetas')
      .select('id, nombre, receta_ingredientes(nombre_libre, alimento:alimentos(nombre))')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .order('nombre')

    if (!todas) query = query.eq('estado', 'aprobada')

    const { data: recetas, error } = await query
    if (error) { console.error('Error BD:', error.message); break }
    if (!recetas || recetas.length === 0) break

    for (const receta of recetas) {
      const tags = autoTagReceta(receta as Parameters<typeof autoTagReceta>[0])
      const tagsStr = tags.length ? tags.join(', ') : '(sin tags)'

      if (dryRun) {
        const estado = tags.length ? '✅' : '⚠️ '
        console.log(`${estado} ${receta.nombre.padEnd(52)} → [${tagsStr}]`)
      } else {
        const { error: err } = await supabase
          .from('recetas')
          .update({ tags })
          .eq('id', receta.id)
        if (err) {
          console.error(`  ❌ ${receta.nombre}: ${err.message}`)
        } else {
          totalActualizadas++
          if (tags.length === 0) sinTags.push(receta.nombre)
        }
      }
    }

    totalVistas += recetas.length
    page++
    if (recetas.length < PAGE_SIZE) break
  }

  console.log(`\n${'─'.repeat(60)}`)
  if (dryRun) {
    console.log(`📋 Preview: ${totalVistas} recetas procesadas`)
  } else {
    console.log(`✅ Actualizadas: ${totalActualizadas} de ${totalVistas} recetas`)
    if (sinTags.length > 0) {
      console.log(`\n⚠️  ${sinTags.length} recetas sin tags detectados (revisar manualmente):`)
      sinTags.forEach(n => console.log(`   • ${n}`))
    }
  }
})()
