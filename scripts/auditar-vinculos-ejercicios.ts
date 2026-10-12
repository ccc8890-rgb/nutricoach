// Audita los ejercicios de los planes activos creados por IA: rehace el emparejado con la lógica actual
// y lo compara con lo guardado. Simula por defecto; con --apply corrige los vínculos distintos.
// Uso: npx tsx scripts/auditar-vinculos-ejercicios.ts [--apply]
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { idEjercicioDeLaIA, type SesionIA } from '../lib/entrenos/guardar-plan'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')

async function main() {
  const { data: planes } = await sb.from('planes_entrenamiento').select('id, nombre, cliente_id, created_at').eq('activo', true)
  const copia: unknown[] = []
  let total = 0, cambios = 0
  for (const plan of planes ?? []) {
    const { data: tareas } = await sb.from('agente_tareas').select('payload, aplicado_at').eq('cliente_id', plan.cliente_id).eq('tipo', 'plan_entreno_ia')
      .in('estado', ['aplicado', 'aprobada', 'aprobado', 'modificado']).order('created_at', { ascending: false }).limit(5)
    const tarea = (tareas ?? []).find(t => t.aplicado_at && Math.abs(new Date(plan.created_at).getTime() - new Date(t.aplicado_at).getTime()) < 5 * 60_000)
    if (!tarea) { console.log(`- ${plan.nombre} (${plan.cliente_id.slice(0, 8)}): sin tarea de IA asociada, no auditable por este camino`); continue }
    const sesionesIA: SesionIA[] = tarea.payload?.plan?.sesiones ?? []
    const { data: sesDB } = await sb.from('sesiones_entrenamiento').select('id, nombre, dia_semana').eq('plan_id', plan.id)
    console.log(`\n## ${plan.nombre} (${plan.cliente_id.slice(0, 8)})`)
    for (const sIA of sesionesIA) {
      const sDB = (sesDB ?? []).find(x => x.nombre === sIA.nombre)
      if (!sDB) continue
      const { data: filas } = await sb.from('sesion_ejercicios').select('id, orden, ejercicio_id, ejercicio:ejercicios(nombre)').eq('sesion_id', sDB.id)
      for (let j = 0; j < (sIA.ejercicios ?? []).length; j++) {
        const ej = sIA.ejercicios![j]
        const fila = (filas ?? []).find(f => f.orden === j + 1)
        if (!fila) continue
        total++
        const esperado = await idEjercicioDeLaIA(sb, sIA, ej)
        if (!esperado || esperado === fila.ejercicio_id) continue
        const { data: nuevo } = await sb.from('ejercicios').select('nombre').eq('id', esperado).single()
        const actual = (Array.isArray(fila.ejercicio) ? fila.ejercicio[0] : fila.ejercicio) as { nombre: string } | null
        cambios++
        console.log(`  ${sDB.dia_semana} · ${sIA.nombre}\n    IA: «${ej.nombre}» ${ej.series}×${ej.repeticiones}\n    ahora: ${actual?.nombre}  →  ${nuevo?.nombre}`)
        copia.push({ fila: fila.id, antes: fila.ejercicio_id, despues: esperado })
        if (APPLY) await sb.from('sesion_ejercicios').update({ ejercicio_id: esperado }).eq('id', fila.id)
      }
    }
  }
  console.log(`\n${total} ejercicios revisados, ${cambios} vínculos ${APPLY ? 'corregidos' : 'a corregir (simulación)'}`)
  if (APPLY && copia.length) { fs.mkdirSync('salidas', { recursive: true }); fs.writeFileSync('salidas/12-10-2026_copia-vinculos-ejercicios.json', JSON.stringify(copia, null, 1)) }
}
main()
