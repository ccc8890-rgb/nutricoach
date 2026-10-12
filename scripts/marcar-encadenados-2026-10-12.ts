// Marca como «encadenado» (sin parar) estación Hyrox → carrera en las sesiones híbridas de planes activos.
// Simula por defecto; con --apply escribe. Requiere la migración 20261012140000.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')
const ESTACION = /sled|skierg|remo erg|row|burpee|wall ball|farmer|granjero/i
const CARRERA = /intervalos \d|carrera continua|carrera/i

;(async () => {
  const { data: planes } = await db.from('planes_entrenamiento').select('id').eq('activo', true)
  const { data: sesiones } = await db.from('sesiones_entrenamiento').select('id,nombre,sesion_ejercicios(id,orden,series,descanso_segundos,encadenado,ejercicio:ejercicios(nombre))').in('plan_id', (planes ?? []).map(p => p.id))
  let n = 0
  for (const s of sesiones ?? []) {
    if (!/híbrid|hibrid|hyrox/i.test(s.nombre)) continue
    const ej = [...((s as any).sesion_ejercicios ?? [])].sort((a: any, b: any) => a.orden - b.orden)
    for (let i = 0; i < ej.length - 1; i++) {
      const a = ej[i], b = ej[i + 1]
      if (a.descanso_segundos !== 0 || a.encadenado || (a.series ?? 0) < 2 || a.series !== b.series) continue
      if (!ESTACION.test(a.ejercicio?.nombre ?? '') || !CARRERA.test(b.ejercicio?.nombre ?? '')) continue
      console.log(`${APPLY ? 'MARCA' : 'marcaría'}: ${s.nombre} · ${a.ejercicio?.nombre} (${a.series}) → ${b.ejercicio?.nombre} (${b.series})`)
      if (APPLY) await db.from('sesion_ejercicios').update({ encadenado: true }).eq('id', a.id)
      n++
    }
  }
  console.log(n, APPLY ? 'marcados' : 'por marcar (usa --apply)')
})()
