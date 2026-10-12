// Repara el plan regenerado de Carlos el 12-10-2026: intervalos de 500 m mal vinculados, «Pilates suave» como trote y pasos del rodaje.
// Simula por defecto; --apply escribe. Copia previa del plan: salidas/12-10-2026_copia-plan-antes-de-regenerar.json
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import { pasosDeSesionCarrera } from '../lib/entrenos/pasos-desde-plan-ia'
import type { SesionIA } from '../lib/entrenos/guardar-plan'
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i)] = process.env[l.slice(0, i)] ?? l.slice(i + 1).replace(/^"|"$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const APPLY = process.argv.includes('--apply')
const CLIENTE = '04cc53b3-851e-43f9-b271-daf1577b743e'

async function idEjercicio(nombre: string) { const { data } = await db.from('ejercicios').select('id').ilike('nombre', nombre).limit(1); return data?.[0]?.id as string | undefined }

;(async () => {
  // 1) Intervalos de distancias que faltaban en el catálogo
  for (const m of [300, 500, 600]) {
    const nombre = `Series run ${m}m`
    if (await idEjercicio(nombre)) continue
    console.log(`${APPLY ? 'añade' : 'añadiría'} al catálogo: ${nombre}`)
    if (APPLY) await db.from('ejercicios').insert({ nombre, grupo_muscular: 'Cardio', tipo: 'cardio', descripcion: `${m} m a ritmo rápido con recuperación en trote.`, custom: false, coach_id: null, video_tipo: 'youtube', equipamiento: [], musculos_secundarios: [], dificultad_nivel: 3 })
  }
  const { data: plan } = await db.from('planes_entrenamiento').select('id').eq('cliente_id', CLIENTE).eq('activo', true).single()
  const { data: ses } = await db.from('sesiones_entrenamiento').select('id,nombre,dia_semana,sesion_ejercicios(id,bloque,repeticiones,ejercicio:ejercicios(nombre))').eq('plan_id', plan!.id)
  const i500 = APPLY ? await idEjercicio('Series run 500m') : 'id-simulado'
  const trote = await idEjercicio('Trote de calentamiento'); const calma = await idEjercicio('Vuelta a la calma')
  for (const s of ses ?? []) {
    for (const e of (s as any).sesion_ejercicios ?? []) {
      const nombre = e.ejercicio?.nombre as string
      let nuevo: string | undefined; let motivo = ''
      if (nombre === 'Series run 1km' && /^500\s*m$/i.test(e.repeticiones ?? '')) { nuevo = i500; motivo = '1km → 500m' }
      else if (nombre === 'Pilates suave' && e.bloque === 'calentamiento') { nuevo = trote; motivo = 'Pilates → Trote de calentamiento' }
      else if (nombre === 'Pilates suave' && e.bloque === 'vuelta_calma') { nuevo = calma; motivo = 'Pilates → Vuelta a la calma' }
      if (!nuevo) continue
      console.log(`${APPLY ? 'corrige' : 'corregiría'}: ${s.dia_semana} · ${s.nombre.slice(0, 40)} · ${motivo}`)
      if (APPLY) await db.from('sesion_ejercicios').update({ ejercicio_id: nuevo }).eq('id', e.id)
    }
  }
  // 2) Pasos del rodaje (el día se cambió respecto al esqueleto y no se calcularon)
  const { data: tarea } = await db.from('agente_tareas').select('payload').eq('tipo', 'plan_entreno_ia').eq('cliente_id', CLIENTE).order('created_at', { ascending: false }).limit(1).single()
  const semana = tarea!.payload.macrociclo?.semanas?.[0]
  for (const s of (tarea!.payload.plan.sesiones as SesionIA[]).filter(x => /rodaje/i.test(String(x.nombre)))) {
    const pasos = pasosDeSesionCarrera(s, semana)
    const dest = (ses ?? []).find(x => /rodaje/i.test(x.nombre))
    console.log(`${APPLY ? 'pasos' : 'pasos (simulados)'} del rodaje:`, pasos ? JSON.stringify(pasos) : 'null')
    if (APPLY && pasos && dest) await db.from('sesiones_entrenamiento').update({ pasos }).eq('id', dest.id)
  }
})().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
