/**
 * Estima tiempo_prep_min de recetas aprobadas que no lo tienen, a partir de sus
 * instrucciones (minutos/horas citados, técnica) y nº de ingredientes.
 * Simula por defecto; --apply para escribir.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')

export function estimarTiempo(instrucciones: string, nIngredientes: number): number {
  const t = instrucciones.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  let citado = 0
  // Reposos (nevera, remojo, marinado, congelado) no son tiempo de trabajo: cada uno suma 5 min
  for (const frase of t.split(/[.\n]/)) {
    if (/nevera|frigor|refriger|remojo|repos|marin|congel|cura|toda la noche/.test(frase)) {
      if (/\d/.test(frase)) citado += 5
      continue
    }
    for (const m of frase.matchAll(/(\d+)\s*(?:[-–a]\s*(\d+)\s*)?(minutos|minuto|min)\b/g)) citado += Number(m[2] ?? m[1])
    for (const m of frase.matchAll(/(\d+)\s*(?:[-–a]\s*(\d+)\s*)?horas?\b/g)) citado += Number(m[2] ?? m[1]) * 60
  }
  const manipulacion = 5 + 2 * Math.ceil(nIngredientes / 3)
  let tecnica = 0
  if (!citado) {
    if (/\bhorno|hornea/.test(t)) tecnica = 25
    else if (/sart[eé]n|plancha|saltea|sofr[ií]e|cuece|hierve/.test(t)) tecnica = 10
    else if (/airfryer|freidora de aire/.test(t)) tecnica = 15
  }
  const total = citado + manipulacion + tecnica
  return Math.min(180, Math.max(5, Math.round(total / 5) * 5))
}

async function main() {
  const { data, error } = await db.from('recetas')
    .select('id, nombre, instrucciones, receta_ingredientes!receta_ingredientes_receta_id_fkey(id)')
    .eq('estado', 'aprobada').or('tiempo_prep_min.is.null,tiempo_prep_min.eq.0')
  if (error) throw error
  console.log(`Recetas aprobadas sin tiempo: ${data?.length}`)
  for (const r of (data ?? []) as any[]) {
    const min = estimarTiempo(r.instrucciones ?? '', r.receta_ingredientes?.length ?? 0)
    console.log(`  ${String(min).padStart(3)} min · ${r.nombre}`)
    if (APPLY) {
      const { error: e } = await db.from('recetas').update({ tiempo_prep_min: min }).eq('id', r.id)
      if (e) throw e
    }
  }
  if (!APPLY) console.log('\nSimulación: nada escrito. Usa --apply.')
}
if (require.main === module) main().catch(e => { console.error('❌', e.message ?? e); process.exit(1) })
