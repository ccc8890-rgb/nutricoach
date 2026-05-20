import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

const PASSWORD = 'TestNutri2026!'
const TEST_MARK = '[TEST_CODEX_FLUJO]'

const clientesTest = [
  {
    slug: 'marta-hipotiroidismo',
    nombre: 'TEST Marta',
    apellidos: 'Hipotiroidismo Perdida',
    email: 'test.codex.marta.hipotiroidismo@example.com',
    objetivoCliente: 'perder_grasa',
    objetivoOnboarding: 'perder_grasa',
    nivel: 'principiante',
    sexo: 'mujer',
    edad: 42,
    peso: 78.4,
    altura: 164,
    restricciones: ['sin lactosa'],
    noGustan: 'pescado azul, coliflor',
    condiciones: 'Hipotiroidismo tratado con levotiroxina. Estreñimiento ocasional. Analítica tiroidea pendiente de revisión médica.',
    autoeficacia: 3,
    actividad: 'ligero',
    diasEntreno: 3,
    tipoEntreno: ['fuerza', 'caminar'],
    cocina: 'basico',
    sportModality: 'gym_estetica',
    objetivoEspecifico: 'perdida_grasa_adherencia',
    lesiones: [],
    plan: {
      kcal: 1650,
      p: 150,
      c: 145,
      g: 55,
      alertas: ['Hipotiroidismo tratado: evitar déficits agresivos y revisar energía/saciedad.', 'Autoeficacia baja: priorizar plan simple y flexible.'],
      notas: 'Test de perdida de grasa con patologia endocrina controlada y baja autoeficacia.',
    },
    crearDieta: false,
    crearEntreno: false,
  },
  {
    slug: 'javier-diabetes-t2',
    nombre: 'TEST Javier',
    apellidos: 'Diabetes Recomposicion',
    email: 'test.codex.javier.diabetes@example.com',
    objetivoCliente: 'recomposicion',
    objetivoOnboarding: 'mantener',
    nivel: 'intermedio',
    sexo: 'hombre',
    edad: 51,
    peso: 91.2,
    altura: 176,
    restricciones: ['control glucemico'],
    noGustan: 'legumbres enteras, yogur natural',
    condiciones: 'Diabetes tipo 2 con metformina. HbA1c reportada 7.1%. Priorizar reparto de hidratos, fibra y adherencia.',
    autoeficacia: 5,
    actividad: 'moderado',
    diasEntreno: 4,
    tipoEntreno: ['fuerza', 'bicicleta'],
    cocina: 'intermedio',
    sportModality: 'hibrido',
    objetivoEspecifico: 'recomposicion_control_glucemico',
    lesiones: [{ zona: 'lumbar', estado: 'historial', detalle: 'Molestia lumbar si hace peso muerto pesado.' }],
    plan: {
      kcal: 2150,
      p: 170,
      c: 205,
      g: 70,
      alertas: ['Diabetes tipo 2: revisar distribucion de carbohidratos y fibra.', 'Evitar sesiones muy largas en ayunas sin control.'],
      notas: 'Test de recomposicion con diabetes tipo 2 y necesidad de control glucemico.',
    },
    crearDieta: true,
    crearEntreno: false,
  },
  {
    slug: 'laura-celiaquia-running',
    nombre: 'TEST Laura',
    apellidos: 'Celiaquia Running',
    email: 'test.codex.laura.celiaquia@example.com',
    objetivoCliente: 'rendimiento',
    objetivoOnboarding: 'rendimiento',
    nivel: 'avanzado',
    sexo: 'mujer',
    edad: 33,
    peso: 58.6,
    altura: 168,
    restricciones: ['celiaquia', 'sin gluten'],
    noGustan: 'huevo cocido',
    condiciones: 'Celiaquia diagnosticada. Objetivo media maraton en 10 semanas. Vigilar disponibilidad de carbohidratos sin gluten.',
    autoeficacia: 8,
    actividad: 'muy_activo',
    diasEntreno: 5,
    tipoEntreno: ['running', 'fuerza'],
    cocina: 'intermedio',
    sportModality: 'running',
    objetivoEspecifico: 'media_maraton_sub_1h45',
    lesiones: [{ zona: 'tibial', estado: 'vigilancia', detalle: 'Sobrecarga tibial previa en bloques de mucho volumen.' }],
    plan: {
      kcal: 2450,
      p: 112,
      c: 350,
      g: 66,
      alertas: ['Celiaquia: todas las propuestas deben ser sin gluten.', 'Competicion cercana: cuidar timing de carbohidratos.'],
      notas: 'Test de rendimiento running con celiaquia y competicion proxima.',
    },
    crearDieta: true,
    crearEntreno: true,
  },
  {
    slug: 'andres-hyrox-rodilla',
    nombre: 'TEST Andres',
    apellidos: 'Hyrox Rodilla',
    email: 'test.codex.andres.hyrox@example.com',
    objetivoCliente: 'rendimiento',
    objetivoOnboarding: 'rendimiento',
    nivel: 'avanzado',
    sexo: 'hombre',
    edad: 36,
    peso: 82.0,
    altura: 181,
    restricciones: [],
    noGustan: 'atun en lata',
    condiciones: 'Sin patologia metabolica. Condromalacia rotuliana leve; evitar picos bruscos de volumen y exceso de wall balls.',
    autoeficacia: 7,
    actividad: 'muy_activo',
    diasEntreno: 5,
    tipoEntreno: ['hyrox', 'fuerza', 'running'],
    cocina: 'avanzado',
    sportModality: 'hyrox',
    objetivoEspecifico: 'hyrox_open_sub_70',
    lesiones: [{ zona: 'rodilla', estado: 'activa leve', detalle: 'Condromalacia rotuliana. Limitar saltos y vigilar wall balls.' }],
    plan: {
      kcal: 2950,
      p: 165,
      c: 405,
      g: 82,
      alertas: ['Rodilla: revisar seleccion de ejercicios antes de asignar plantilla Hyrox.', 'Alto gasto semanal: no infracalorar.'],
      notas: 'Test de Hyrox avanzado con restriccion de rodilla.',
    },
    crearDieta: false,
    crearEntreno: true,
  },
  {
    slug: 'nuria-sop-vegetariana',
    nombre: 'TEST Nuria',
    apellidos: 'SOP Vegetariana',
    email: 'test.codex.nuria.sop@example.com',
    objetivoCliente: 'perder_grasa',
    objetivoOnboarding: 'perder_grasa',
    nivel: 'intermedio',
    sexo: 'mujer',
    edad: 29,
    peso: 69.5,
    altura: 162,
    restricciones: ['vegetariana', 'sin carne', 'sin pescado'],
    noGustan: 'tofu ahumado, berenjena',
    condiciones: 'Sindrome de ovario poliquistico. Vegetariana. Hambre alta por la tarde y ansiedad por dulce.',
    autoeficacia: 4,
    actividad: 'moderado',
    diasEntreno: 4,
    tipoEntreno: ['fuerza', 'pilates'],
    cocina: 'intermedio',
    sportModality: 'gym_estetica',
    objetivoEspecifico: 'perdida_grasa_sop',
    lesiones: [],
    plan: {
      kcal: 1750,
      p: 125,
      c: 180,
      g: 58,
      alertas: ['SOP: priorizar saciedad, proteina y fibra.', 'Vegetariana: revisar fuentes proteicas y micronutrientes.'],
      notas: 'Test de perdida de grasa con SOP y patron vegetariano.',
    },
    crearDieta: true,
    crearEntreno: true,
  },
]

async function requireOk(label, promise) {
  const result = await promise
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

async function getCoach() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,nombre,apellidos,email')
    .eq('role', 'coach')
    .eq('email', 'ccc8890@gmail.com')
    .single()

  if (error || !data) throw new Error('No se ha encontrado el coach Carlos en profiles')
  return data
}

async function findAuthUserByEmail(email) {
  let page = 1
  while (page < 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    const found = data.users.find(user => user.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (data.users.length < 100) return null
    page += 1
  }
  return null
}

async function ensureAuthUser(cliente) {
  const existing = await findAuthUserByEmail(cliente.email)
  if (existing) return existing

  const { data, error } = await supabase.auth.admin.createUser({
    email: cliente.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      nombre: cliente.nombre,
      apellidos: cliente.apellidos,
      role: 'cliente',
    },
  })

  if (error) throw error
  return data.user
}

function planJson(cliente) {
  const comidas = [
    { nombre: 'Desayuno', porcentaje_kcal: 25, kcal: Math.round(cliente.plan.kcal * 0.25), hora_sugerida: '08:00', notas: 'Opcion simple y repetible.' },
    { nombre: 'Comida', porcentaje_kcal: 35, kcal: Math.round(cliente.plan.kcal * 0.35), hora_sugerida: '14:00', notas: 'Comida principal alta en proteina.' },
    { nombre: 'Merienda', porcentaje_kcal: 15, kcal: Math.round(cliente.plan.kcal * 0.15), hora_sugerida: '17:30', notas: 'Control de hambre y energia.' },
    { nombre: 'Cena', porcentaje_kcal: 25, kcal: Math.round(cliente.plan.kcal * 0.25), hora_sugerida: '21:00', notas: 'Cena saciante, digestiva y ajustada al objetivo.' },
  ]

  return {
    kcal_objetivo: cliente.plan.kcal,
    macros: {
      proteinas_g: cliente.plan.p,
      carbos_g: cliente.plan.c,
      grasas_g: cliente.plan.g,
    },
    distribucion_comidas: comidas,
    estrategia_adherencia: 'Perfil TEST para validar flujo coach, adherencia, patologias y objetivos.',
    valvula_escape: '1 comida flexible semanal planificada, ajustada a condicion y objetivo.',
    recomendaciones: [
      'Validar que la pantalla de revision muestra correctamente onboarding basico y profundo.',
      'Comprobar recetas sugeridas y acciones rapidas antes de aprobar.',
    ],
    alertas_coach: cliente.plan.alertas,
    notas_coach: `${cliente.plan.notas} ${TEST_MARK}`,
  }
}

function onboardingProfundo(cliente) {
  return {
    trigger_onboarding: 'Quiere validar que el plan se adapte a su contexto real.',
    autoeficacia: cliente.autoeficacia,
    historial_dietas: ['Dieta generica online', 'Seguimiento parcial con app'],
    razones_abandono: cliente.autoeficacia <= 4 ? ['hambre', 'falta de tiempo', 'todo_o_nada'] : ['monotonia'],
    relacion_comida: cliente.autoeficacia <= 4 ? 'Ansiedad ocasional y dificultad para sostener planes rigidos.' : 'Relacion funcional, acepta estructura.',
    todo_o_nada: cliente.autoeficacia <= 4 ? 'si' : 'a_veces',
    dia_tipico: 'Trabajo, entrenamiento y comidas con margen limitado entre semana.',
    comidas_favoritas: 'Arroz, patata, yogur, fruta, bowls sencillos.',
    alimentos_evitar_extra: cliente.noGustan,
    alcohol_semanal: '0-2 consumiciones',
    suplementos: 'Cafeina ocasional. Proteina en polvo si encaja.',
    hora_primera_ingesta: '08:00',
    hora_comida_principal: '14:00',
    hora_ultima_ingesta: '21:00',
    hora_entreno: cliente.diasEntreno >= 5 ? '18:30' : '19:30',
    patrones_energia: ['bajada_tarde'],
    con_quien_come: ['pareja', 'compis_trabajo'],
    frecuencia_fuera: cliente.slug.includes('hyrox') ? '3-4' : '1-2',
    comida_trampa: 'Cena social semanal',
    condiciones_salud: cliente.condiciones,
    horas_sueno: cliente.autoeficacia <= 4 ? 6 : 7.5,
    calidad_sueno: cliente.autoeficacia <= 4 ? 2 : 4,
    nivel_estres: cliente.autoeficacia <= 4 ? 5 : 3,
    descripcion_semana_entreno: `${cliente.diasEntreno} dias/semana: ${cliente.tipoEntreno.join(', ')}`,
    fecha_competicion: cliente.objetivoCliente === 'rendimiento' ? '2026-08-30' : null,
    tipo_competicion: cliente.objetivoCliente === 'rendimiento' ? cliente.objetivoEspecifico : null,
    nutricion_peri_entreno: 'Pendiente de individualizar tras revisar tolerancia digestiva.',
    analisis_disponibles: ['analitica_basica'],
    analisis_valores: {},
    tests_recomendados_pendientes: ['peso semanal', 'perimetro cintura'],
    composicion_metodo: 'bioimpedancia',
    composicion_grasa_pct: cliente.sexo === 'mujer' ? 29 : 23,
    composicion_masa_muscular_kg: cliente.sexo === 'mujer' ? 24 : 36,
    composicion_objetivo_grasa_pct: cliente.objetivoCliente === 'rendimiento' ? null : cliente.sexo === 'mujer' ? 24 : 18,
    peso_competicion: cliente.objetivoCliente === 'rendimiento' ? Math.round(cliente.peso * 0.98) : null,
    vo2max: cliente.sportModality === 'running' ? 49 : cliente.sportModality === 'hyrox' ? 52 : null,
    notas_analisis: `${TEST_MARK} Perfil creado para QA, no usar como cliente real.`,
  }
}

function perfilEntreno(cliente) {
  return {
    sport_modality: cliente.sportModality,
    objetivo_especifico: cliente.objetivoEspecifico,
    nivel: cliente.nivel,
    dias_disponibles: cliente.diasEntreno,
    mejor_momento_sesion: cliente.slug.includes('marta') ? 'manana' : 'tarde',
    ftp_watts: cliente.sportModality === 'ciclismo' ? 240 : null,
    vdot: cliente.sportModality === 'running' ? 45 : null,
    rm_sentadilla_kg: cliente.sexo === 'hombre' ? 120 : 70,
    rm_banca_kg: cliente.sexo === 'hombre' ? 90 : 42.5,
    rm_peso_muerto_kg: cliente.sexo === 'hombre' ? 150 : 90,
    dominadas_max_reps: cliente.nivel === 'avanzado' ? 10 : 3,
    capacidad_recuperacion: cliente.autoeficacia <= 4 ? 'baja' : 'media',
    respuesta_a_volumen: cliente.diasEntreno >= 5 ? 'alto' : 'medio',
    patron_lesiones: cliente.lesiones,
    adherencia_historica_pct: cliente.autoeficacia <= 4 ? 55 : 82,
    respuesta_psicologica: cliente.objetivoCliente === 'rendimiento' ? 'competicion' : 'rutina',
    plateau_detectado: false,
    semanas_sin_progresion: 0,
    equipo_disponible: cliente.sportModality === 'hyrox'
      ? ['barra', 'mancuernas', 'ski_erg', 'sled', 'wall_ball', 'cardio_maquinas']
      : ['barra', 'mancuernas', 'polea', 'cardio_maquinas'],
    restricciones_temporales: cliente.lesiones.length ? cliente.lesiones.map(l => l.detalle).join(' ') : null,
    hrv_baseline: cliente.objetivoCliente === 'rendimiento' ? 62 : null,
    vo2max_estimado: cliente.sportModality === 'running' ? 49 : cliente.sportModality === 'hyrox' ? 52 : null,
    fms_score: null,
    fisio_informe: cliente.lesiones,
    analisis_sangre: [],
  }
}

async function replaceByClienteId(table, clienteId, payload) {
  await requireOk(`delete ${table}`, supabase.from(table).delete().eq('cliente_id', clienteId))
  return requireOk(`insert ${table}`, supabase.from(table).insert(payload).select('*').single())
}

async function recreateDiet(cliente, coachId, clienteId) {
  await supabase
    .from('planes_nutricion')
    .delete()
    .eq('cliente_id', clienteId)
    .ilike('nombre', 'Plan TEST Codex%')

  if (!cliente.crearDieta) return null

  const plan = await requireOk(
    'insert plan nutricion',
    supabase
      .from('planes_nutricion')
      .insert({
        coach_id: coachId,
        cliente_id: clienteId,
        nombre: `Plan TEST Codex - ${cliente.nombre}`,
        descripcion: `${TEST_MARK} Dieta activa de prueba para validar revision rapida.`,
        kcal_objetivo: cliente.plan.kcal,
        proteinas_objetivo: cliente.plan.p,
        carbohidratos_objetivo: cliente.plan.c,
        grasas_objetivo: cliente.plan.g,
        activo: true,
        generado_por_ia: true,
        codigo_publico: `test-codex-${cliente.slug}`,
      })
      .select('id')
      .single()
  )

  const comidas = planJson(cliente).distribucion_comidas.map((comida, index) => ({
    plan_id: plan.id,
    nombre: comida.nombre,
    orden: index,
    hora_sugerida: comida.hora_sugerida,
  }))

  await requireOk('insert comidas test', supabase.from('comidas').insert(comidas))
  return plan.id
}

async function recreateTraining(cliente, coachId, clienteId) {
  await supabase
    .from('planes_entrenamiento')
    .delete()
    .eq('cliente_id', clienteId)
    .ilike('nombre', 'Entreno TEST Codex%')

  if (!cliente.crearEntreno) return null

  const plan = await requireOk(
    'insert plan entrenamiento',
    supabase
      .from('planes_entrenamiento')
      .insert({
        coach_id: coachId,
        cliente_id: clienteId,
        nombre: `Entreno TEST Codex - ${cliente.sportModality}`,
        descripcion: `${TEST_MARK} Plan activo de prueba para validar estado de entrega.`,
        duracion_semanas: 8,
        activo: true,
      })
      .select('id')
      .single()
  )

  const sesiones = [
    { plan_id: plan.id, nombre: 'Sesion 1 - Fuerza base', dia_semana: 'Lunes', orden: 1, notas: 'Sesion placeholder para QA.' },
    { plan_id: plan.id, nombre: 'Sesion 2 - Condicionamiento', dia_semana: 'Miercoles', orden: 2, notas: 'Sesion placeholder para QA.' },
    { plan_id: plan.id, nombre: 'Sesion 3 - Tecnica / zona 2', dia_semana: 'Viernes', orden: 3, notas: 'Sesion placeholder para QA.' },
  ]
  await requireOk('insert sesiones entrenamiento test', supabase.from('sesiones_entrenamiento').insert(sesiones))
  return plan.id
}

async function ensureCliente(coachId, cliente) {
  const authUser = await ensureAuthUser(cliente)

  await requireOk(
    'update profile',
    supabase
      .from('profiles')
      .update({
        nombre: cliente.nombre,
        apellidos: cliente.apellidos,
        email: cliente.email,
      })
      .eq('id', authUser.id)
  )

  const existing = await requireOk(
    'select cliente',
    supabase.from('clientes').select('id').eq('profile_id', authUser.id).maybeSingle()
  )

  const clientePayload = {
    profile_id: authUser.id,
    coach_id: coachId,
    objetivo: cliente.objetivoCliente,
    nivel: cliente.nivel,
    peso_inicial: cliente.peso,
    altura: cliente.altura,
    edad: cliente.edad,
    sexo: cliente.sexo,
    restricciones_alimentarias: cliente.restricciones.join(', ') || null,
    notas: `${TEST_MARK} ${cliente.condiciones}`,
    activo: true,
    revisado_por_coach: false,
    onboarding_completado: true,
    fecha_proxima_revision: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    last_portal_access: null,
    updated_at: new Date().toISOString(),
  }

  let clienteRow
  if (existing?.id) {
    clienteRow = await requireOk(
      'update cliente',
      supabase.from('clientes').update(clientePayload).eq('id', existing.id).select('id').single()
    )
  } else {
    clienteRow = await requireOk(
      'insert cliente',
      supabase.from('clientes').insert(clientePayload).select('id').single()
    )
  }

  const clienteId = clienteRow.id

  await replaceByClienteId('onboarding_responses', clienteId, {
    cliente_id: clienteId,
    segmento: 'standard',
    objetivo: cliente.objetivoOnboarding,
    actividad_base: cliente.actividad,
    dias_entreno: cliente.diasEntreno,
    tipo_entreno: cliente.tipoEntreno,
    duracion_sesion_min: cliente.diasEntreno >= 5 ? 75 : 60,
    restricciones: cliente.restricciones,
    alimentos_no_gustan: cliente.noGustan,
    nivel_cocina: cliente.cocina,
    tiempo_cocina_min: cliente.cocina === 'basico' ? 20 : 35,
    presupuesto_semanal_eur: cliente.slug.includes('javier') ? 85 : 65,
  })

  await replaceByClienteId('onboarding_perfil_profundo', clienteId, {
    cliente_id: clienteId,
    ...onboardingProfundo(cliente),
  })

  await replaceByClienteId('perfil_entreno_cliente', clienteId, {
    cliente_id: clienteId,
    ...perfilEntreno(cliente),
  })

  await supabase
    .from('registros_ia')
    .delete()
    .eq('cliente_id', clienteId)
    .eq('modelo', 'codex-seed-test')

  await requireOk(
    'insert registro ia test',
    supabase.from('registros_ia').insert({
      coach_id: coachId,
      cliente_id: clienteId,
      tipo: 'dieta',
      prompt: `${TEST_MARK} Prompt sintetico para QA de flujo con patologias/objetivos.`,
      respuesta_json: planJson(cliente),
      modelo: 'codex-seed-test',
      tokens_usados: 0,
    })
  )

  const dietaId = await recreateDiet(cliente, coachId, clienteId)
  const entrenoId = await recreateTraining(cliente, coachId, clienteId)

  return {
    id: clienteId,
    nombre: `${cliente.nombre} ${cliente.apellidos}`,
    email: cliente.email,
    objetivo: cliente.objetivoCliente,
    condicion: cliente.condiciones.split('.')[0],
    dietaId,
    entrenoId,
    revisarRapido: `/clientes/${clienteId}/revisar-rapido`,
    revisarPlan: `/clientes/${clienteId}/revisar-plan`,
    portal: dietaId ? `/cliente/test-codex-${cliente.slug}` : null,
  }
}

async function main() {
  const coach = await getCoach()
  const resultados = []

  for (const cliente of clientesTest) {
    console.log(`Creando/actualizando ${cliente.nombre}...`)
    resultados.push(await ensureCliente(coach.id, cliente))
  }

  console.log('\nClientes TEST creados/actualizados:')
  for (const r of resultados) {
    console.log(`- ${r.nombre}`)
    console.log(`  id: ${r.id}`)
    console.log(`  objetivo: ${r.objetivo}`)
    console.log(`  condicion: ${r.condicion}`)
    console.log(`  revisar rapido: ${r.revisarRapido}`)
    console.log(`  revisar plan: ${r.revisarPlan}`)
    console.log(`  dieta activa: ${r.dietaId ? 'si' : 'no'} | entreno activo: ${r.entrenoId ? 'si' : 'no'}`)
    if (r.portal) console.log(`  portal publico: ${r.portal}`)
  }

  console.log(`\nPassword de los usuarios TEST: ${PASSWORD}`)
  console.log('Todos quedan marcados con [TEST_CODEX_FLUJO] y revisado_por_coach=false.')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
