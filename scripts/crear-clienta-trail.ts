// Clienta ficticia deportista (corredora de trail, ultra 50 km) con plan de nutrición y competición.
// Uso: npx tsx scripts/crear-clienta-trail.ts  (idempotente por email)
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { guardarDietaHabitualCliente } from '../lib/dieta-habitual'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const COACH_ID = 'f62aea4e-69a2-4062-b517-bb6a639ee1b5'
const EMAIL = 'laura.vidal.trail@nutricoach-test.dev'

const dia_tipico = 'Desayuno: tostada con aguacate y huevo y un café con leche. Media mañana: una pieza de fruta o un yogur. Comida: arroz con verduras y pollo o pasta con atún. Merienda: yogur con frutos secos. Cena: tortilla francesa con ensalada o crema de verduras con pan.'
const comidas_favoritas = 'arroz con pollo, pasta con pollo, tostada con aguacate y huevo, yogur con frutos secos'

async function main() {
  // 1. Usuario, perfil y cliente
  const { data: lista } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
  let uid = lista?.users.find(u => u.email === EMAIL)?.id
  if (!uid) {
    const { data, error } = await db.auth.admin.createUser({ email: EMAIL, password: 'TestNutri2026!', email_confirm: true, user_metadata: { nombre: 'Laura', apellidos: 'Vidal', role: 'cliente' } })
    if (error) throw error
    uid = data.user.id
  }
  await db.from('profiles').upsert({ id: uid, nombre: 'Laura', apellidos: 'Vidal', email: EMAIL, role: 'cliente' }, { onConflict: 'id' })
  const payload = {
    profile_id: uid, coach_id: COACH_ID, objetivo: 'rendimiento', nivel: 'avanzado', peso_inicial: 58, altura: 165, edad: 31, sexo: 'mujer',
    restricciones_alimentarias: 'Ninguna', notas: 'Corredora de trail. Ultra de 50 km en 5 semanas. Sin patologías. Quiere llegar fuerte sin perder peso.',
    activo: true, revisado_por_coach: true, onboarding_completado: true, updated_at: new Date().toISOString(),
  }
  const { data: ex } = await db.from('clientes').select('id').eq('profile_id', uid).maybeSingle()
  const { data: cli, error: ce } = ex ? await db.from('clientes').update(payload).eq('id', ex.id).select('id').single() : await db.from('clientes').insert(payload).select('id').single()
  if (ce || !cli) throw ce
  const clienteId = cli.id

  // 2. Cuestionario
  await db.from('onboarding_responses').delete().eq('cliente_id', clienteId)
  await db.from('onboarding_responses').insert({
    cliente_id: clienteId, objetivo: 'rendimiento', actividad_base: 'muy_activo', dias_entreno: 5, tipo_entreno: ['trail_running', 'fuerza', 'running'],
    duracion_sesion_min: 90, restricciones: [], alimentos_no_gustan: 'pescado azul, coliflor', nivel_cocina: 'intermedio', tiempo_cocina_min: 30,
    presupuesto_semanal_eur: 70, segmento: 'performance', objetivo_deportivo: 'Ultra Trail 50 km — terminar entre las 20 primeras de su categoría',
    alimentos_base: ['arroz', 'pasta', 'huevo', 'pollo', 'aguacate', 'yogur'],
  })
  await db.from('onboarding_perfil_profundo').delete().eq('cliente_id', clienteId)
  await db.from('onboarding_perfil_profundo').insert({
    cliente_id: clienteId, trigger_onboarding: 'Ultra de 50 km en 5 semanas. Quiere llegar bien alimentada y sin molestias digestivas.', condiciones_salud: 'Ninguna',
    dia_tipico, comidas_favoritas, alimentos_evitar_extra: 'pescado azul, coliflor',
    descripcion_semana_entreno: 'L: fuerza 60 min. M: series en cuesta. X: rodaje suave. J: tempo. V: descanso. S: tirada larga 2-3 h. D: rodaje suave.',
    suplementos: 'Magnesio por la noche, geles en tiradas largas', hora_entreno: '07:00', nivel_estres: 2, calidad_sueno: 4,
    fecha_competicion: '2026-11-15', tipo_competicion: 'Ultra Trail 50 km',
  })
  await guardarDietaHabitualCliente(db, clienteId, { dia_tipico, comidas_favoritas, alimentos_base: ['arroz', 'pasta', 'huevo', 'pollo', 'aguacate', 'yogur'] })

  // 3. Plan de nutrición (TDEE ≈ 2.200 kcal: Mifflin 1.295 × 1,7; proteína 1,8 g/kg, hidratos 5 g/kg)
  await db.from('planes_nutricion').update({ activo: false }).eq('cliente_id', clienteId)
  const { error: pe } = await db.from('planes_nutricion').insert({
    coach_id: COACH_ID, cliente_id: clienteId, nombre: 'Plan rendimiento trail', activo: true, generado_por_ia: false,
    descripcion: 'Plan de preparación de ultra trail de 50 km. Respeta sus platos habituales (tostada con aguacate y huevo, arroz con pollo, yogur con frutos secos).',
    kcal_objetivo: 2200, proteinas_objetivo: 104, carbohidratos_objetivo: 290, grasas_objetivo: 69,
    codigo_publico: Math.random().toString(36).slice(2, 12),
  })
  if (pe) throw pe

  // 4. Competición
  await db.from('competiciones').delete().eq('cliente_id', clienteId)
  const { error: ke } = await db.from('competiciones').insert({ cliente_id: clienteId, nombre: 'Ultra Trail 50 km', disciplina: 'trail_largo', fecha_competicion: '2026-11-15', objetivo: 'completar', tiempo_objetivo_min: 390 })
  if (ke) throw ke
  console.log('Clienta creada:', clienteId, EMAIL)
}
main().catch(e => { console.error(e); process.exit(1) })
