/**
 * 6 clientes ficticios nuevos (18-10-2026) para estresar el motor con perfiles que no se habían probado:
 * perimenopausia + hipertensión, adolescente con alergia a frutos secos y poco presupuesto, diabetes tipo 2 + celiaquía,
 * CrossFit + SOP pescetariana sin lactosa, mayor con ERC + hipertensión, turno de noche con alergia a huevo y marisco.
 * Uso: npx tsx scripts/crear-clientes-nuevos-2026-10-18.ts   (idempotente por email; no genera plan con IA)
 * El plan de macros se calcula aquí (Mifflin-St Jeor × factor de actividad ± ajuste), no con el generador de IA.
 */
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

type Perfil = {
  nombre: string; apellidos: string; email: string; sexo: 'hombre' | 'mujer'; edad: number; peso: number; altura: number
  factor: number; ajuste: number; protGkg: number; grasaPct: number
  objetivoCliente: string; objetivoOnb: string; nivel: string; segmento: string; actividad: string
  restricciones: string[]; restriccionTexto: string; evitar: string; condiciones: string
  diasEntreno: number; tipoEntreno: string[]; duracion: number; tiempoCocina: number; presupuesto: number; cocina: string
  base: string[]; diaTipico: string; favoritas: string; notas: string; horaEntreno: string; comidasDia?: number
  descripcionSemana: string; suplementos: string
}

const PERFILES: Perfil[] = [
  {
    nombre: 'Marta', apellidos: 'Iglesias', email: 'marta.iglesias.perimenopausia@nutricoach-test.dev', sexo: 'mujer', edad: 52, peso: 68, altura: 163,
    factor: 1.4, ajuste: -0.15, protGkg: 1.6, grasaPct: 0.3,
    objetivoCliente: 'recomposicion', objetivoOnb: 'perder_grasa', nivel: 'intermedio', segmento: 'standard', actividad: 'moderado',
    restricciones: [], restriccionTexto: 'Ninguna', evitar: 'hígado, sardinas', condiciones: 'Hipertensión arterial (TA 145/90, medicada con enalapril). Perimenopausia con sofocos. Colesterol LDL algo elevado (135 mg/dL).',
    diasEntreno: 3, tipoEntreno: ['pilates', 'caminar'], duracion: 50, tiempoCocina: 20, presupuesto: 60, cocina: 'basico',
    base: ['pescado', 'verduras', 'legumbres', 'yogur', 'fruta'], diaTipico: 'Desayuno: café con leche y tostada con tomate. Comida: lentejas o ensalada con pollo. Merienda: fruta o yogur. Cena: tortilla con ensalada o merluza al horno.',
    favoritas: 'lentejas, merluza al horno, ensalada, tortilla francesa', notas: 'Oficina, poco tiempo para cocinar. Quiere bajar 6 kg y controlar la tensión sin medicarse más.', horaEntreno: '18:30',
    descripcionSemana: 'L, X y V: pilates 50 min. M y J: paseo rápido 40 min.', suplementos: 'Ninguno',
  },
  {
    nombre: 'Daniel', apellidos: 'Ortega', email: 'daniel.ortega.hardgainer@nutricoach-test.dev', sexo: 'hombre', edad: 19, peso: 62, altura: 181,
    factor: 1.6, ajuste: 0.15, protGkg: 2.0, grasaPct: 0.25,
    objetivoCliente: 'rendimiento', objetivoOnb: 'ganar_musculo', nivel: 'intermedio', segmento: 'standard', actividad: 'muy_activo',
    restricciones: ['sin frutos secos'], restriccionTexto: 'Alergia a frutos secos y cacahuetes', evitar: 'frutos secos, cacahuetes, crema de cacahuete', condiciones: 'Alergia a frutos secos y cacahuetes (reacción en urgencias a los 8 años). Sin otras patologías.',
    diasEntreno: 4, tipoEntreno: ['fuerza', 'hipertrofia'], duracion: 75, tiempoCocina: 25, presupuesto: 35, cocina: 'basico',
    base: ['arroz', 'pasta', 'pollo', 'huevo', 'legumbres', 'avena', 'plátano'], diaTipico: 'Desayuno: cereales con leche y plátano. Comida: pasta con carne picada o arroz con pollo. Merienda: bocadillo de jamón. Cena: huevos con patatas o pizza casera.',
    favoritas: 'pasta boloñesa, arroz con pollo, bocadillos, huevos fritos', notas: 'Estudiante, 62 kg y no consigue subir. Presupuesto muy ajustado. Come poco por falta de apetito.', horaEntreno: '19:00',
    descripcionSemana: 'L: pecho/tríceps. M: espalda/bíceps. J: pierna. S: hombro/brazo.', suplementos: 'Creatina 5 g',
  },
  {
    nombre: 'Rafael', apellidos: 'Benítez', email: 'rafael.benitez.diabetes.celiaco@nutricoach-test.dev', sexo: 'hombre', edad: 45, peso: 118, altura: 178,
    factor: 1.3, ajuste: -0.2, protGkg: 1.2, grasaPct: 0.3,
    objetivoCliente: 'recomposicion', objetivoOnb: 'perder_grasa', nivel: 'intermedio', segmento: 'standard', actividad: 'moderado',
    restricciones: ['sin gluten'], restriccionTexto: 'Celiaquía (sin gluten estricto)', evitar: 'pan, pasta con gluten, cerveza', condiciones: 'Diabetes mellitus tipo 2 (HbA1c 7,4 %, metformina 850 mg). Enfermedad celíaca diagnosticada: sin gluten estricto. Obesidad grado II (IMC 37). Sin ejercicio regular.',
    diasEntreno: 2, tipoEntreno: ['caminar'], duracion: 40, tiempoCocina: 30, presupuesto: 70, cocina: 'intermedio',
    base: ['carne', 'pescado', 'verduras', 'arroz', 'patata', 'legumbres'], diaTipico: 'Desayuno: café con leche y galletas sin gluten. Comida: arroz con carne o guiso de patatas. Merienda: fruta. Cena: pescado con ensalada.',
    favoritas: 'arroz con carne, guisos, pescado a la plancha, fruta', notas: 'Trabajo sedentario. Quiere bajar 20 kg y mejorar la glucosa. Se salta comidas y luego pica.', horaEntreno: '20:00',
    descripcionSemana: 'M y J: paseo 40 min.', suplementos: 'Ninguno',
  },
  {
    nombre: 'Irene', apellidos: 'Salas', email: 'irene.salas.crossfit.sop@nutricoach-test.dev', sexo: 'mujer', edad: 34, peso: 63, altura: 168,
    factor: 1.6, ajuste: -0.03, protGkg: 1.8, grasaPct: 0.3,
    objetivoCliente: 'recomposicion', objetivoOnb: 'perder_grasa', nivel: 'avanzado', segmento: 'recomposicion', actividad: 'muy_activo',
    restricciones: ['sin lactosa'], restriccionTexto: 'Pescetariana, sin lactosa', evitar: 'carne, pollo, cerdo, ternera, embutidos', condiciones: 'Síndrome de ovario poliquístico (SOP) con resistencia a la insulina leve. Intolerancia a la lactosa. Pescetariana desde hace 5 años.',
    diasEntreno: 5, tipoEntreno: ['crossfit', 'fuerza'], duracion: 70, tiempoCocina: 35, presupuesto: 75, cocina: 'intermedio',
    base: ['pescado', 'huevo', 'legumbres', 'quinoa', 'arroz', 'verduras', 'fruta'], diaTipico: 'Desayuno: tostada con aguacate y huevo y café. Comida: bowl de legumbres con pescado o arroz con verduras y atún. Merienda: fruta con frutos secos. Cena: salmón con verduras o revuelto.',
    favoritas: 'salmón, bowls de legumbres, huevos, tostadas con aguacate', notas: 'CrossFit 5 días. Quiere mejorar composición y regular el ciclo. Evita lácteos por lactosa.', horaEntreno: '07:00',
    descripcionSemana: 'L, M, J, V: WOD CrossFit 60 min. S: fuerza 70 min.', suplementos: 'Inositol, vitamina D',
  },
  {
    nombre: 'Julián', apellidos: 'Prieto', email: 'julian.prieto.erc.mayor@nutricoach-test.dev', sexo: 'hombre', edad: 68, peso: 74, altura: 172,
    factor: 1.5, ajuste: 0, protGkg: 0.8, grasaPct: 0.3,
    objetivoCliente: 'mantenimiento', objetivoOnb: 'mantener', nivel: 'intermedio', segmento: 'standard', actividad: 'moderado',
    restricciones: [], restriccionTexto: 'Ninguna', evitar: 'embutidos, conservas, sal añadida', condiciones: 'Enfermedad renal crónica estadio 3a (eGFR 52 mL/min), hipertensión arterial controlada. Pérdida leve de masa muscular. Controlar potasio y sodio; proteína moderada según nefrólogo.',
    diasEntreno: 5, tipoEntreno: ['caminar', 'fuerza suave'], duracion: 45, tiempoCocina: 40, presupuesto: 70, cocina: 'intermedio',
    base: ['verduras', 'pescado', 'pollo', 'arroz', 'patata', 'fruta'], diaTipico: 'Desayuno: tostada con aceite y café con leche. Comida: guiso de verduras con pollo o arroz con pescado. Merienda: fruta. Cena: sopa y tortilla.',
    favoritas: 'guisos, pescado al horno, arroz, sopa', notas: 'Jubilado, camina cada día. El nefrólogo limita la proteína y la sal; el médico de cabecera quiere que no pierda músculo.', horaEntreno: '10:00',
    descripcionSemana: 'Paseo diario de 45 min. L y J: fuerza suave con gomas 20 min.', suplementos: 'Ninguno',
  },
  {
    nombre: 'Sergio', apellidos: 'Lago', email: 'sergio.lago.turno.noche@nutricoach-test.dev', sexo: 'hombre', edad: 38, peso: 82, altura: 180,
    factor: 1.5, ajuste: 0, protGkg: 1.8, grasaPct: 0.3,
    objetivoCliente: 'mantenimiento', objetivoOnb: 'mantener', nivel: 'intermedio', segmento: 'standard', actividad: 'moderado',
    restricciones: ['sin huevo', 'sin mariscos'], restriccionTexto: 'Alergia al huevo y al marisco', evitar: 'huevo, marisco, gambas, mayonesa', condiciones: 'Alergia al huevo y a los crustáceos. Trabaja a turnos (noches rotativas), sueño irregular. Reflujo gastroesofágico ocasional.',
    diasEntreno: 3, tipoEntreno: ['fuerza', 'running'], duracion: 55, tiempoCocina: 15, presupuesto: 70, cocina: 'basico',
    base: ['pollo', 'arroz', 'pasta', 'legumbres', 'verduras', 'yogur'], diaTipico: 'Turno de noche: cena a las 21:00 antes de entrar (pasta con pollo), snack a las 02:00 (bocadillo de pavo), desayuno a las 08:30 al salir (yogur con cereales), comida a las 15:00 tras dormir (arroz con verduras).',
    favoritas: 'pasta con pollo, bocadillos de pavo, arroz con verduras, yogur', notas: 'Enfermero. Horarios cambiantes, come en el trabajo. Quiere mantener peso y energía en las noches.', horaEntreno: '16:30', comidasDia: 4,
    descripcionSemana: 'Fuerza 2 días y rodaje 1 día, según el turno.', suplementos: 'Cafeína en turno',
  },
]

function plan(p: Perfil) {
  const bmr = 10 * p.peso + 6.25 * p.altura - 5 * p.edad + (p.sexo === 'hombre' ? 5 : -161)
  const kcal = Math.round((bmr * p.factor * (1 + p.ajuste)) / 10) * 10
  const prot = Math.round(p.protGkg * p.peso)
  const gras = Math.round((kcal * p.grasaPct) / 9)
  const carb = Math.max(0, Math.round((kcal - prot * 4 - gras * 9) / 4))
  return { kcal, prot, gras, carb }
}

async function crear(p: Perfil) {
  const { data: lista } = await db.auth.admin.listUsers({ page: 1, perPage: 500 })
  let uid = lista?.users.find(u => u.email === p.email)?.id
  if (!uid) {
    const { data, error } = await db.auth.admin.createUser({ email: p.email, password: 'TestNutri2026!', email_confirm: true, user_metadata: { nombre: p.nombre, apellidos: p.apellidos, role: 'cliente' } })
    if (error) throw error
    uid = data.user.id
  }
  await db.from('profiles').upsert({ id: uid, nombre: p.nombre, apellidos: p.apellidos, email: p.email, role: 'cliente' }, { onConflict: 'id' })
  const payload = {
    profile_id: uid, coach_id: COACH_ID, objetivo: p.objetivoCliente, nivel: p.nivel, peso_inicial: p.peso, altura: p.altura, edad: p.edad, sexo: p.sexo,
    restricciones_alimentarias: p.restriccionTexto, notas: p.notas, activo: true, revisado_por_coach: true, onboarding_completado: true,
    ...(p.comidasDia ? { comidas_dia: p.comidasDia } : {}), updated_at: new Date().toISOString(),
  }
  const { data: ex } = await db.from('clientes').select('id').eq('profile_id', uid).maybeSingle()
  const { data: cli, error: ce } = ex ? await db.from('clientes').update(payload).eq('id', ex.id).select('id').single() : await db.from('clientes').insert(payload).select('id').single()
  if (ce || !cli) throw new Error(`${p.nombre}: ${ce?.message}`)
  const id = cli.id

  await db.from('onboarding_responses').delete().eq('cliente_id', id)
  const { error: oe } = await db.from('onboarding_responses').insert({
    cliente_id: id, objetivo: p.objetivoOnb, actividad_base: p.actividad, dias_entreno: p.diasEntreno, tipo_entreno: p.tipoEntreno, duracion_sesion_min: p.duracion,
    restricciones: p.restricciones, alimentos_no_gustan: p.evitar, nivel_cocina: p.cocina, tiempo_cocina_min: p.tiempoCocina, presupuesto_semanal_eur: p.presupuesto,
    segmento: p.segmento, alimentos_base: p.base,
  })
  if (oe) throw new Error(`${p.nombre} onboarding: ${oe.message}`)
  await db.from('onboarding_perfil_profundo').delete().eq('cliente_id', id)
  const { error: pe0 } = await db.from('onboarding_perfil_profundo').insert({
    cliente_id: id, trigger_onboarding: p.notas, condiciones_salud: p.condiciones, dia_tipico: p.diaTipico, comidas_favoritas: p.favoritas,
    alimentos_evitar_extra: p.evitar, descripcion_semana_entreno: p.descripcionSemana, suplementos: p.suplementos, hora_entreno: p.horaEntreno, nivel_estres: 3, calidad_sueno: 3,
  })
  if (pe0) throw new Error(`${p.nombre} perfil: ${pe0.message}`)
  await guardarDietaHabitualCliente(db, id, { dia_tipico: p.diaTipico, comidas_favoritas: p.favoritas, alimentos_base: p.base })

  const m = plan(p)
  await db.from('planes_nutricion').update({ activo: false }).eq('cliente_id', id)
  const { error: pe } = await db.from('planes_nutricion').insert({
    coach_id: COACH_ID, cliente_id: id, nombre: `Plan ${p.objetivoOnb.replace('_', ' ')} — ${p.nombre}`, activo: true, generado_por_ia: false,
    descripcion: `Plan de prueba calculado con Mifflin-St Jeor (×${p.factor}, ${p.ajuste >= 0 ? '+' : ''}${Math.round(p.ajuste * 100)} %).`,
    kcal_objetivo: m.kcal, proteinas_objetivo: m.prot, carbohidratos_objetivo: m.carb, grasas_objetivo: m.gras,
    codigo_publico: Math.random().toString(36).slice(2, 12),
  })
  if (pe) throw new Error(`${p.nombre} plan: ${pe.message}`)
  console.log(`${id.slice(0, 8)} ${p.nombre} ${p.apellidos} — ${m.kcal} kcal · P${m.prot} C${m.carb} G${m.gras}`)
}

async function main() { for (const p of PERFILES) await crear(p) }
main().catch(e => { console.error(e); process.exit(1) })
