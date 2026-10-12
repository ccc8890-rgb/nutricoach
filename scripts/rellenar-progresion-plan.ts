// Rellena la progresión semanal del plan activo de un cliente desde la última propuesta aplicada (macrociclo) y quita cifras de los nombres de sesión.
// Uso: npx tsx scripts/rellenar-progresion-plan.ts <prefijoClienteId> [--apply]
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import { nombreSinCifras, progresionDeMacro } from '../lib/entrenos/progresion-semanal'
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i)] = process.env[l.slice(0, i)] ?? l.slice(i + 1).replace(/^"|"$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
;(async () => {
  const apply = process.argv.includes('--apply')
  const { data: cl } = await db.from('clientes').select('id'); const id = cl!.find(c => c.id.startsWith(process.argv[2] ?? ''))!.id as string
  const { data: plan } = await db.from('planes_entrenamiento').select('id,duracion_semanas,created_at').eq('cliente_id', id).eq('activo', true).single()
  const { data: tarea } = await db.from('agente_tareas').select('payload').eq('cliente_id', id).eq('tipo', 'plan_entreno_ia').eq('estado', 'aplicado').order('created_at', { ascending: false }).limit(1).single()
  const prog = progresionDeMacro(tarea?.payload?.macrociclo?.semanas, plan!.duracion_semanas)
  console.log('progresión:', prog ? prog.semanas.map(s => `S${s.n}${s.descarga ? '(descarga)' : ''} ${s.sesiones.map(x => `${x.tipo} ${x.minutos}`).join('/')}`).join(' · ') : 'sin macrociclo')
  const { data: ses } = await db.from('sesiones_entrenamiento').select('id,nombre').eq('plan_id', plan!.id)
  for (const s of ses ?? []) { const nuevo = nombreSinCifras(s.nombre); if (nuevo !== s.nombre) { console.log(`nombre: «${s.nombre}» → «${nuevo}»`); if (apply) await db.from('sesiones_entrenamiento').update({ nombre: nuevo }).eq('id', s.id) } }
  if (apply && prog) await db.from('planes_entrenamiento').update({ progresion: prog }).eq('id', plan!.id)
  console.log(apply ? 'aplicado' : '(simulación)')
})()
