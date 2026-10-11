// scripts/crear-propuesta-plan.ts — genera con el enrutador real el plan de un cliente y lo deja como PROPUESTA pendiente
// (tarea `plan_entreno_ia`, igual que «Planificar con IA»). No cambia el plan activo: lo aprueba o rechaza el coach en la ficha.
// Uso: npx tsx scripts/crear-propuesta-plan.ts [prefijoClienteId=04cc53b3] [fase=Base|Fuerza|Resistencia|Deload]
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import { generarPlanEntrenoIA } from '../lib/entrenos/generar-plan-ia'
import { construirPayloadPropuesta, construirResumenPropuesta } from '../lib/entrenos/planificar-con-ia'
import { evaluarPlanIA } from '../lib/entrenos/evaluar-plan-ia'

for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i)] = process.env[l.slice(0, i)] ?? l.slice(i + 1).replace(/^"|"$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
;(async () => {
  const pre = process.argv[2] ?? '04cc53b3'
  const fase = (process.argv[3] ?? undefined) as 'Base' | 'Fuerza' | 'Resistencia' | 'Deload' | undefined
  const { data } = await db.from('clientes').select('id')
  const id = data!.find(c => c.id.startsWith(pre))!.id as string
  const { data: pend } = await db.from('agente_tareas').select('id').eq('cliente_id', id).eq('tipo', 'plan_entreno_ia').in('estado', ['pendiente', 'en_revision']).limit(1)
  if (pend?.length) { console.log('YA HAY una propuesta pendiente para este cliente:', pend[0].id); return }
  const t0 = Date.now()
  const r = await generarPlanEntrenoIA(db, { clienteId: id, faseBloqueObjetivo: fase })
  const ev = evaluarPlanIA(r, r.esHibrido ? 6 : null)
  const resumen = construirResumenPropuesta(r, 'crear')
  const { data: tarea, error } = await db.from('agente_tareas').insert({
    tipo: 'plan_entreno_ia', cliente_id: id, agente: 'planificador', estado: 'pendiente', prioridad: 2,
    payload: construirPayloadPropuesta(r, 'crear'), propuesta: resumen,
    razonamiento: typeof r.planIA.fundamentacion === 'string' ? r.planIA.fundamentacion : null, fuentes: [],
  }).select('id').single()
  if (error) throw new Error(error.message)
  const sesiones = ((r.planIA.sesiones as Record<string, unknown>[]) ?? []).map(s => `${s.dia_semana} · ${s.nombre} · ${s.duracion_min ?? '?'} min`)
  console.log(JSON.stringify({ tarea: tarea!.id, segundos: Math.round((Date.now() - t0) / 1000), modelo: r.metadata.generado_con, uso: r.metadata.uso, puntuacion: ev.puntuacion, resumen, sesiones, hallazgos: r.validacion?.hallazgos.map(h => h.codigo) ?? [], correccion: (r.planIA as Record<string, unknown>)._correccion ?? null }, null, 2))
})().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
