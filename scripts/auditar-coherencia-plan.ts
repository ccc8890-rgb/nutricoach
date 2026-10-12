// Cruza, para CADA semana del bloque de cada plan activo, la lista de ejercicios, los pasos del reloj y las rondas: tienen que coincidir.
// Solo lectura. Uso: npx tsx scripts/auditar-coherencia-plan.ts
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import { comprobarCoherenciaPlan } from '../lib/entrenos/coherencia-plan'
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i)] = process.env[l.slice(0, i)] ?? l.slice(i + 1).replace(/^"|"$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
;(async () => {
  const { data: planes } = await db.from('planes_entrenamiento').select('id, nombre, created_at, duracion_semanas, progresion').eq('activo', true)
  let total = 0
  for (const p of planes ?? []) {
    const { data: ses } = await db.from('sesiones_entrenamiento').select('id, nombre, pasos').eq('plan_id', p.id)
    const { data: ejs } = await db.from('sesion_ejercicios').select('sesion_id, orden, bloque, series, repeticiones, peso_sugerido, encadenado, ejercicio:ejercicios(nombre, tipo)').in('sesion_id', (ses ?? []).map(s => s.id))
    const problemas = comprobarCoherenciaPlan(p as never, (ses ?? []).map(s => ({ nombre: s.nombre, pasos: s.pasos, ejercicios: (ejs ?? []).filter(e => e.sesion_id === s.id) as never })))
    console.log(`${problemas.length ? '✗' : '✓'} ${p.nombre} (${p.duracion_semanas ?? '?'} sem${p.progresion ? ', con progresión' : ', sin progresión'}): ${problemas.length ? '' : 'coherente'}`)
    for (const m of problemas) console.log('   -', m)
    total += problemas.length
  }
  console.log(total ? `\n${total} desajuste(s)` : '\nTodo coherente')
  process.exit(total ? 1 : 0)
})()
