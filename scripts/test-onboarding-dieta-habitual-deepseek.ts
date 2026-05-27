import dotenv from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { construirPrompt, generarDietaConIA, type DietaGenerada } from '../lib/deepseek'
import { calcularTargetSlot, filtrarRecetasPorSlot } from '../lib/plan-recetas'
import { formatearDietaHabitualParaPrompt, guardarDietaHabitualCliente } from '../lib/dieta-habitual'
import { aplicarRecetaAComida } from '../lib/recetas/aplicar-receta-comida'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
}

type Coach = { id: string; email: string; nombre: string | null }
type Receta = {
  id: string
  nombre: string
  categoria?: string | null
  kcal: number
  proteinas: number
  carbohidratos: number
  grasas: number
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const TEST_EMAIL = 'test.deepseek.adherencia@nutricoach.local'
const TEST_PASSWORD = 'TestNutri2026!'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const onboarding = {
  segmento: 'standard',
  objetivo: 'perder_grasa',
  actividad_base: 'moderado',
  dias_entreno: 4,
  tipo_entreno: ['fuerza', 'running'],
  duracion_sesion_min: 60,
  restricciones: [] as string[],
  alimentos_no_gustan: 'pescado azul, coliflor',
  nivel_cocina: 'basico',
  tiempo_cocina_min: 20,
  presupuesto_semanal_eur: 75,
  horario_comidas: [
    { nombre: 'Desayuno', hora: '07:30' },
    { nombre: 'Comida', hora: '14:00' },
    { nombre: 'Merienda', hora: '17:30' },
    { nombre: 'Cena', hora: '21:00' },
  ],
  alimentos_base: ['café', 'pan', 'tomate', 'jamón', 'pollo', 'arroz', 'huevo', 'tacos'],
}

const perfilProfundo = {
  trigger_onboarding: 'Quiero verme mejor sin sentir que estoy a dieta y rendir bien entrenando.',
  autoeficacia: 6,
  historial_dietas: ['déficit flexible', 'dieta de tupper'],
  razones_abandono: ['comidas aburridas', 'poca vida social'],
  relacion_comida: 'normal, pero me cuesta controlar dulce por la tarde',
  todo_o_nada: false,
  dia_tipico: 'Desayuno café con leche y tostadas de tomate con jamón. A media mañana fruta o nada. Comida arroz con pollo o menú de trabajo. Merienda café y algo dulce. Cena tortilla, sándwich o tacos.',
  comidas_favoritas: 'tostadas de tomate con jamón, tacos Big Mac, tiramisú fit, burger casera, tortilla francesa',
  alimentos_evitar_extra: 'pescado azul, coliflor',
  alcohol_semanal: 1,
  suplementos: 'creatina ocasional',
  come_fuera_dias: 2,
  alimentos_base: onboarding.alimentos_base,
  hora_primera_ingesta: '07:30',
  hora_comida_principal: '14:00',
  hora_ultima_ingesta: '21:00',
  hora_entreno: '18:30',
  patrones_energia: ['baja energía por la tarde si no meriendo'],
  con_quien_come: ['pareja', 'trabajo'],
  frecuencia_fuera: '2 días/semana',
  comida_trampa: 'hamburguesa o tacos el fin de semana',
  condiciones_salud: 'sin patologías conocidas',
  horas_sueno: 7,
  calidad_sueno: 3,
  nivel_estres: 3,
  descripcion_semana_entreno: 'Fuerza lunes, miércoles y viernes. Running suave martes o sábado.',
  nutricion_peri_entreno: 'Suele entrenar por la tarde, necesita llegar con energía sin pesadez.',
}

function logPaso(texto: string) {
  console.log(`\n${texto}`)
}

async function requireData<T>(label: string, promise: PromiseLike<{ data: T; error: unknown }>) {
  const result = await promise
  if (result.error) {
    const message = result.error instanceof Error ? result.error.message : JSON.stringify(result.error)
    throw new Error(`${label}: ${message}`)
  }
  return result.data
}

async function getCoach() {
  return requireData<Coach>('coach', db
    .from('profiles')
    .select('id,email,nombre')
    .eq('role', 'coach')
    .eq('email', 'ccc8890@gmail.com')
    .single())
}

async function findAuthUserByEmail(email: string) {
  let page = 1
  while (page < 20) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    const found = data.users.find(user => user.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (data.users.length < 100) return null
    page += 1
  }
  return null
}

async function ensureClient(coach: Coach) {
  const existingUser = await findAuthUserByEmail(TEST_EMAIL)
  const authUser = existingUser ?? (await requireData('crear auth user test', db.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      nombre: 'TEST DeepSeek',
      apellidos: 'Adherencia Onboarding',
      role: 'cliente',
    },
  }))).user

  await requireData('upsert profile cliente', db.from('profiles').upsert({
    id: authUser.id,
    email: TEST_EMAIL,
    nombre: 'TEST DeepSeek',
    apellidos: 'Adherencia Onboarding',
    role: 'cliente',
  }, { onConflict: 'id' }).select('id').single())

  const { data: existingCliente } = await db
    .from('clientes')
    .select('id')
    .eq('profile_id', authUser.id)
    .maybeSingle()

  const payload = {
    profile_id: authUser.id,
    coach_id: coach.id,
    objetivo: 'recomposicion',
    peso_inicial: 72,
    altura: 174,
    edad: 36,
    sexo: 'hombre',
    restricciones_alimentarias: null,
    notas: '[TEST_DEEPSEEK_ADHERENCIA] Cliente creado para validar onboarding con dieta habitual.',
    activo: true,
    revisado_por_coach: false,
    onboarding_completado: true,
    fecha_proxima_revision: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    updated_at: new Date().toISOString(),
  }

  if (existingCliente?.id) {
    const updated = await requireData<{ id: string }>('actualizar cliente test', db
      .from('clientes')
      .update(payload)
      .eq('id', existingCliente.id)
      .select('id')
      .single())
    return updated.id
  }

  const inserted = await requireData<{ id: string }>('crear cliente test', db
    .from('clientes')
    .insert(payload)
    .select('id')
    .single())
  return inserted.id
}

async function saveOnboarding(clienteId: string) {
  await requireData('upsert onboarding_responses', db.from('onboarding_responses').upsert({
    cliente_id: clienteId,
    ...onboarding,
  }, { onConflict: 'cliente_id' }).select('id').single())

  const perfilPermitido = Object.fromEntries(Object.entries(perfilProfundo).filter(([key]) => ![
    'come_fuera_dias',
    'alimentos_base',
  ].includes(key)))

  await requireData('upsert onboarding_perfil_profundo', db.from('onboarding_perfil_profundo').upsert({
    cliente_id: clienteId,
    ...perfilPermitido,
  }, { onConflict: 'cliente_id' }).select('id').single())

  return guardarDietaHabitualCliente(db, clienteId, {
    dia_tipico: perfilProfundo.dia_tipico,
    comidas_favoritas: perfilProfundo.comidas_favoritas,
    alimentos_base: onboarding.alimentos_base,
  })
}

async function getPlantillas(coachId: string) {
  const { data } = await db
    .from('plantillas_dieta')
    .select('id,nombre,kcal_objetivo,proteinas_objetivo,carbohidratos_objetivo,grasas_objetivo')
    .eq('coach_id', coachId)
    .limit(20)
  return data ?? []
}

async function buildCandidates(clienteId: string) {
  const kcalObjetivo = 2250
  const proteinasObjetivo = 145
  const slots = ['Desayuno', 'Comida', 'Merienda', 'Cena']
  const candidatasPorSlot = new Map<string, Receta[]>()

  for (const slot of slots) {
    const { targetKcal, targetProt } = calcularTargetSlot(slot, kcalObjetivo, proteinasObjetivo, slots.length)
    const candidatas = await filtrarRecetasPorSlot(
      db as SupabaseClient,
      slot,
      targetKcal,
      targetProt,
      {
        restricciones: onboarding.restricciones,
        alimentos_evitar_extra: perfilProfundo.alimentos_evitar_extra,
        tiempo_cocina_min: onboarding.tiempo_cocina_min,
        alimentos_base: onboarding.alimentos_base,
      },
      8,
      clienteId,
      onboarding.objetivo,
      undefined,
      'hibrido'
    )
    candidatasPorSlot.set(slot, candidatas as Receta[])
  }

  return { kcalObjetivo, proteinasObjetivo, slots, candidatasPorSlot }
}

function buildPromptInput(
  dietaHabitual: Awaited<ReturnType<typeof guardarDietaHabitualCliente>>,
  candidatasPorSlot: Map<string, Receta[]>
) {
  const recetas = [...candidatasPorSlot.values()].flat()
  const candidatasBlock = [...candidatasPorSlot.entries()].map(([slot, recetasSlot]) => {
    const items = recetasSlot.map(r =>
      `  {"id":"${r.id}","nombre":"${r.nombre}","kcal":${Math.round(r.kcal)},"prot":${Math.round(r.proteinas)}}`
    ).join(',\n')
    return `${slot.toUpperCase()}_CANDIDATAS:\n[\n${items}\n]`
  }).join('\n\n')

  const contexto = `
PLATOS HABITUALES DETECTADOS DEL ONBOARDING:
${formatearDietaHabitualParaPrompt(dietaHabitual)}

CANDIDATAS REALES POR MOMENTO:
${candidatasBlock}

TEST DE ADHERENCIA:
- Devuelve exactamente estos slots: Desayuno, Comida, Merienda, Cena.
- Si aparece media mañana en la dieta habitual, intégrala dentro de Desayuno o Merienda; no crees un quinto slot.
- En desayuno debe intentar respetar café + tostada/tomate/jamón si existe candidata compatible.
- En merienda debe resolver el patrón de café + dulce con una opción fitness o alta en proteína.
- En cena puede usar tacos/burger/tortilla si encaja, en versión healthy.
- Marca "habitual_adaptado" cuando mantenga la identidad del hábito.
- Si no existe receta exacta, elige lo más cercano y explica qué falta en el recetario.`

  return { recetas, contexto }
}

function resolveMealRecipes(
  dieta: DietaGenerada,
  candidatasPorSlot: Map<string, Receta[]>
) {
  const recetasPorId = new Map([...candidatasPorSlot.values()].flat().map(r => [r.id, r]))
  const recetasPorNombre = new Map([...candidatasPorSlot.values()].flat().map(r => [r.nombre.toLowerCase().trim(), r]))

  return dieta.comidas.map((comida, index) => {
    const slot = comida.nombre || ['Desayuno', 'Comida', 'Merienda', 'Cena'][index]
    const candidatas = candidatasPorSlot.get(slot) ?? []
    const first = comida.alimentos?.[0]
    const selected =
      (first?.receta_id ? recetasPorId.get(first.receta_id) : undefined) ??
      (first?.receta_nombre ? recetasPorNombre.get(first.receta_nombre.toLowerCase().trim()) : undefined) ??
      candidatas[0]

    const alternativas = candidatas
      .filter(r => r.id !== selected?.id)
      .slice(0, 3)
      .map(r => r.id)

    return {
      nombre: slot,
      orden: comida.orden ?? index + 1,
      receta: selected,
      alternativas,
      cantidad_porciones: first?.cantidad_porciones ?? 1,
      origen_adherencia: comida.origen_adherencia ?? 'recetario',
      adaptacion_habitual: comida.adaptacion_habitual ?? null,
    }
  }).filter(c => Boolean(c.receta))
}

async function persistPlan(params: {
  coachId: string
  clienteId: string
  dieta: DietaGenerada
  comidas: ReturnType<typeof resolveMealRecipes>
  kcalObjetivo: number
  proteinasObjetivo: number
}) {
  await db.from('planes_nutricion').update({ activo: false }).eq('cliente_id', params.clienteId)

  const codigoPublico = `test-adherencia-${crypto.randomUUID().slice(0, 8)}`
  const plan = await requireData<{ id: string; codigo_publico: string }>('crear plan nutricion test', db.from('planes_nutricion').insert({
    coach_id: params.coachId,
    cliente_id: params.clienteId,
    nombre: 'TEST DeepSeek - Dieta habitual adaptada',
    descripcion: params.dieta.notas ?? 'Plan test generado con DeepSeek desde onboarding con dieta habitual.',
    kcal_objetivo: params.kcalObjetivo,
    proteinas_objetivo: params.proteinasObjetivo,
    carbohidratos_objetivo: params.dieta.macros_totales?.carbohidratos ?? 260,
    grasas_objetivo: params.dieta.macros_totales?.grasas ?? 75,
    activo: true,
    generado_por_ia: true,
    codigo_publico: codigoPublico,
  }).select('id,codigo_publico').single())

  for (const comida of params.comidas) {
    if (!comida.receta) continue
    const target = calcularTargetSlot(comida.nombre, params.kcalObjetivo, params.proteinasObjetivo, params.comidas.length)
    const comidaDb = await requireData<{ id: string }>('crear comida test', db.from('comidas').insert({
      plan_id: plan.id,
      nombre: comida.nombre,
      orden: comida.orden,
      dia_semana: 'Lunes',
      hora_sugerida: ({ Desayuno: '07:30', Comida: '14:00', Merienda: '17:30', Cena: '21:00' } as Record<string, string>)[comida.nombre] ?? null,
      receta_id: comida.receta.id,
      alternativas_receta_ids: comida.alternativas,
      kcal_target: target.targetKcal,
      proteinas_target: target.targetProt,
      origen_adherencia: comida.origen_adherencia,
      adaptacion_habitual: comida.adaptacion_habitual,
    }).select('id').single())

    await aplicarRecetaAComida(db as SupabaseClient, {
      comidaId: comidaDb.id,
      recetaId: comida.receta.id,
      clienteId: params.clienteId,
      planId: plan.id,
      comidaSlot: comida.nombre,
      targetKcal: target.targetKcal,
      tipoInteraccion: 'asignada_plan',
      reemplazar: true,
    })
  }

  return plan
}

async function main() {
  logPaso('1. Preparando cliente test')
  const coach = await getCoach()
  const clienteId = await ensureClient(coach)
  const dietaHabitual = await saveOnboarding(clienteId)

  logPaso('2. Dieta habitual detectada')
  console.table(dietaHabitual.map(p => ({
    momento: p.momento,
    texto: p.texto_original,
    estrategia: p.estrategia,
  })))

  logPaso('3. Buscando recetas candidatas reales por comida')
  const { kcalObjetivo, proteinasObjetivo, candidatasPorSlot } = await buildCandidates(clienteId)
  for (const [slot, recetas] of candidatasPorSlot.entries()) {
    console.log(`${slot}: ${recetas.map(r => r.nombre).join(' | ')}`)
  }

  logPaso('4. Llamando a DeepSeek')
  const plantillas = await getPlantillas(coach.id)
  const { recetas, contexto } = buildPromptInput(dietaHabitual, candidatasPorSlot)
  const prompt = construirPrompt(
    {
      nombre: 'TEST DeepSeek Adherencia',
      objetivo: onboarding.objetivo,
      kcal_objetivo: kcalObjetivo,
      proteina_g: proteinasObjetivo,
      carbos_g: 260,
      grasas_g: 75,
      peso_kg: 72,
      edad: 36,
      sexo: 'hombre',
      actividad: onboarding.actividad_base,
      dias_entreno: onboarding.dias_entreno,
      restricciones: onboarding.restricciones,
      condiciones: perfilProfundo.condiciones_salud,
      comidas_favoritas: perfilProfundo.comidas_favoritas,
      nivel_cocina: onboarding.nivel_cocina,
      presupuesto: String(onboarding.presupuesto_semanal_eur),
    },
    plantillas,
    recetas.map(r => ({
      id: r.id,
      nombre: r.nombre,
      categoria: r.categoria ?? 'Otras',
      kcal: r.kcal,
      proteinas: r.proteinas,
      carbohidratos: r.carbohidratos,
      grasas: r.grasas,
    })),
    contexto
  )
  const { data: dieta, total_tokens: tokens } = await generarDietaConIA(prompt, contexto)
  const comidas = resolveMealRecipes(dieta, candidatasPorSlot)

  logPaso('5. Persistiendo plan real')
  const plan = await persistPlan({
    coachId: coach.id,
    clienteId,
    dieta,
    comidas,
    kcalObjetivo,
    proteinasObjetivo,
  })

  await db.from('registros_ia').insert({
    coach_id: coach.id,
    cliente_id: clienteId,
    tipo: 'dieta',
    prompt,
    respuesta_json: {
      ...dieta,
      test: 'onboarding_dieta_habitual_deepseek',
      comidas_resueltas: comidas.map(c => ({
        slot: c.nombre,
        receta: c.receta?.nombre,
        origen_adherencia: c.origen_adherencia,
        adaptacion_habitual: c.adaptacion_habitual,
        alternativas: c.alternativas.length,
      })),
    },
    modelo: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    tokens_usados: tokens,
  })

  logPaso('Resultado')
  console.table(comidas.map(c => ({
    comida: c.nombre,
    receta: c.receta?.nombre,
    origen: c.origen_adherencia,
    adaptacion: c.adaptacion_habitual,
    alternativas: c.alternativas.length,
  })))

  console.log(JSON.stringify({
    clienteId,
    planId: plan.id,
    codigoPublico: plan.codigo_publico,
    portal: `${APP_URL}/cliente/${plan.codigo_publico}?tab=dieta`,
    coach: `${APP_URL}/clientes/${clienteId}`,
    emailCliente: TEST_EMAIL,
    passwordCliente: TEST_PASSWORD,
    tokensDeepSeek: tokens,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
