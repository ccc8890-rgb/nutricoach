/**
 * Corrige recetas con gluten etiquetadas incorrectamente:
 * - Recetas con pasta/pan/macarrones/espaguetis/cuscús/harina de trigo
 *   que NO tienen tag 'Gluten' → añadir 'Gluten', eliminar 'Sin Gluten' si lo tenían
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const PATRONES_GLUTEN = [
  'macarr', 'espagueti', 'espaguet', 'pasta', 'harina de trigo',
  'pan de ajo', 'pan cas', 'pan inte', 'pan cen', 'tosta de pan',
  'shawarma.*pan', 'wraps?.*trigo', 'tortilla.*trigo', 'cuscús', 'cous',
  'farfalle', 'penne', 'rigatoni', 'lasaña', 'cannelloni', 'gnocch'
]

async function main() {
  const DRY = !process.argv.includes('--apply')
  console.log(`Modo: ${DRY ? 'DRY-RUN' : 'APPLY'}`)

  // Buscar todas las aprobadas que suenan a gluten pero no tienen tag 'Gluten'
  const { data: todas } = await db.from('recetas')
    .select('id, nombre, intolerancias')
    .eq('estado', 'aprobada')
    .not('intolerancias', 'ov', '{Gluten}')

  const aCorregir = (todas ?? []).filter(r => {
    const nombreLow = r.nombre.toLowerCase()
    return PATRONES_GLUTEN.some(p => new RegExp(p).test(nombreLow))
  })

  console.log(`\nRecetas a corregir: ${aCorregir.length}`)

  let corregidas = 0
  for (const r of aCorregir) {
    const intolActual: string[] = r.intolerancias ?? []
    // Quitar 'Sin Gluten' (incorrecto) y añadir 'Gluten'
    const nueva = [...intolActual.filter(t => t !== 'Sin Gluten'), 'Gluten']
    console.log(`  ${DRY ? '[DRY]' : '✅'} ${r.nombre}`)
    console.log(`       antes: [${intolActual.join(', ')}]`)
    console.log(`       después: [${nueva.join(', ')}]`)

    if (!DRY) {
      await db.from('recetas').update({ intolerancias: nueva }).eq('id', r.id)
      corregidas++
    }
  }

  if (!DRY) console.log(`\nCorregidas: ${corregidas}`)
  else console.log('\nEjecuta con --apply para aplicar los cambios')
}
main().catch(console.error)
