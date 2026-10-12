// Aplica una propuesta `plan_entreno_ia` conservando los días de la semana del plan activo (por tipo de sesión) y guarda copia del plan anterior.
// Uso: npx tsx scripts/aplicar-propuesta-conservando-dias.ts <tareaId> [--apply]
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import { aplicarPlanEntrenoIA } from '../lib/entrenos/aplicar-plan-ia'
import type { AgenteTarea } from '../lib/agentes/types'

for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i)] = process.env[l.slice(0, i)] ?? l.slice(i + 1).replace(/^"|"$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const tipo = (n: string) => /tirada/i.test(n) ? 'tirada' : /rodaje/i.test(n) ? 'rodaje' : /series|intervalos/i.test(n) && !/h[ií]brid/i.test(n) ? 'series' : /tempo/i.test(n) ? 'tempo'
  : /pierna/i.test(n) ? 'pierna' : /superior a|skierg/i.test(n) ? 'A' : /superior b|row|remo/i.test(n) ? 'B' : 'otra'

;(async () => {
  const id = process.argv[2]; const aplicar = process.argv.includes('--apply')
  const { data: tarea } = await db.from('agente_tareas').select('*').eq('id', id).single()
  if (!tarea) throw new Error('Tarea no encontrada')
  const { data: plan } = await db.from('planes_entrenamiento').select('id,nombre').eq('cliente_id', tarea.cliente_id).eq('activo', true).single()
  const { data: viejas } = await db.from('sesiones_entrenamiento').select('nombre,dia_semana').eq('plan_id', plan!.id)
  const diaPorTipo = new Map((viejas ?? []).map(s => [tipo(s.nombre), s.dia_semana as string]))
  const sesiones = (tarea.payload.plan.sesiones as Record<string, unknown>[])
  for (const s of sesiones) {
    const t = tipo(String(s.nombre)); const antes = s.dia_semana
    if (diaPorTipo.has(t)) s.dia_semana = diaPorTipo.get(t)
    console.log(`${String(s.nombre).slice(0, 55).padEnd(55)} ${String(antes).padEnd(10)} → ${s.dia_semana}  [${t}]`)
  }
  if (!aplicar) { console.log('(simulación)'); return }
  const { data: completo } = await db.from('planes_entrenamiento').select('*, sesiones:sesiones_entrenamiento(*, ejercicios:sesion_ejercicios(*))').eq('id', plan!.id).single()
  fs.mkdirSync('salidas', { recursive: true })
  fs.writeFileSync(`salidas/12-10-2026_copia-plan-antes-de-regenerar.json`, JSON.stringify(completo, null, 1))
  await db.from('agente_tareas').update({ payload: tarea.payload }).eq('id', id)
  const r = await aplicarPlanEntrenoIA(db, { ...tarea } as AgenteTarea)
  console.log(JSON.stringify(r))
})().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
