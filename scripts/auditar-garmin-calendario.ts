// Lista (solo lectura) lo que hay en la cuenta de Garmin de un cliente: biblioteca de entrenos y calendario de los próximos meses,
// marcando cuáles creó NutriCoach (los que tienen su id guardado en alguna sesión). Con --borrar-propios borra SOLO esos y limpia las marcas
// para que el cron los vuelva a crear con los pasos actuales. No toca los entrenos que el atleta creó por su cuenta.
// Uso: npx tsx scripts/auditar-garmin-calendario.ts <cliente_id> [--borrar-propios]
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { descifrarConexionGarmin } from '../lib/integraciones/garmin-connect-perclient'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
Object.assign(process.env, { GARMIN_CREDENTIALS_KEY: env.GARMIN_CREDENTIALS_KEY })
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const clienteId = process.argv[2]
const BORRAR = process.argv.includes('--borrar-propios')

async function main() {
  if (!clienteId) throw new Error('Falta el cliente_id')
  const { data: integ } = await db.from('integraciones_cliente').select('credenciales_json').eq('cliente_id', clienteId).eq('proveedor', 'garmin_connect').maybeSingle()
  if (!integ?.credenciales_json) throw new Error('Sin Garmin conectado')
  const c = descifrarConexionGarmin(integ.credenciales_json)
  const { GarminConnect } = await import('garmin-connect')
  const gc = new GarminConnect({ username: c.email, password: c.password })
  if (c.oauth1 && c.oauth2) { gc.loadToken(c.oauth1, c.oauth2); try { await gc.getUserProfile() } catch { await gc.login() } } else await gc.login()
  const api = (gc as unknown as { url: { GC_API: string } }).url.GC_API

  // Ids que NutriCoach tiene guardados (de cualquier plan del cliente, activo o no)
  const { data: planes } = await db.from('planes_entrenamiento').select('id, nombre, activo').eq('cliente_id', clienteId)
  const { data: ses } = await db.from('sesiones_entrenamiento').select('id, nombre, plan_id, garmin_workout_id, garmin_fechas').in('plan_id', (planes ?? []).map(p => p.id)).not('garmin_workout_id', 'is', null)
  const propios = new Map<string, { nombre: string; plan: string; activo: boolean; sesionId: string }>()
  for (const s of ses ?? []) { const p = planes!.find(x => x.id === s.plan_id)!; propios.set(String(s.garmin_workout_id), { nombre: s.nombre, plan: p.nombre, activo: p.activo, sesionId: s.id }) }

  const biblioteca = (await gc.getWorkouts(0, 200)) as unknown as { workoutId: number; workoutName: string; updatedDate?: string; createdDate?: string }[]
  console.log(`\n## BIBLIOTECA (${biblioteca.length} entrenos)`)
  for (const w of biblioteca) {
    const p = propios.get(String(w.workoutId))
    console.log(`${p ? (p.activo ? '● NutriCoach (plan activo)' : '○ NutriCoach (plan ANTIGUO)') : '· de Carlos / otro'} | ${w.workoutId} | ${w.workoutName} | ${(w.createdDate ?? w.updatedDate ?? '').slice(0, 10)}`)
  }

  console.log('\n## CALENDARIO (octubre–diciembre 2026)')
  const entradas: { fecha: string; titulo: string; workoutId?: string }[] = []
  const vistos = new Set<string>() // el calendario devuelve los días de borde de un mes también en el siguiente
  for (const mes of [9, 10, 11]) {
    try {
      const r = (await gc.client.get(`${api}/calendar-service/year/2026/month/${mes}`)) as { calendarItems?: { id?: number; date: string; title: string; itemType: string; workoutId?: number }[] }
      for (const it of r.calendarItems ?? []) if (it.itemType === 'workout' && !vistos.has(String(it.id ?? `${it.date}-${it.workoutId}`)) && vistos.add(String(it.id ?? `${it.date}-${it.workoutId}`))) entradas.push({ fecha: it.date, titulo: it.title, workoutId: it.workoutId ? String(it.workoutId) : undefined })
    } catch (e) { console.log(`mes ${mes + 1}: no se pudo leer (${(e as Error).message?.slice(0, 80)})`) }
  }
  for (const e of entradas.sort((a, b) => a.fecha.localeCompare(b.fecha))) console.log(`${e.fecha} | ${e.titulo} | ${e.workoutId && propios.has(e.workoutId) ? 'NutriCoach' : 'otro'}`)
  if (entradas.length === 0) console.log('(nada programado en el calendario)')

  if (!BORRAR) { console.log('\nSolo lectura. Para borrar lo de NutriCoach: --borrar-propios'); return }
  let n = 0
  for (const [id, p] of propios) {
    try { await gc.deleteWorkout({ workoutId: id } as never); n++ } catch { /* ya no existía */ }
    await db.from('sesiones_entrenamiento').update({ garmin_workout_id: null, garmin_programado_fecha: null, garmin_fechas: [], garmin_pasos_hash: null }).eq('id', p.sesionId)
  }
  console.log(`\nBorrados ${n} entrenos de NutriCoach y marcas limpiadas (el cron los vuelve a crear con los pasos actuales).`)
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
