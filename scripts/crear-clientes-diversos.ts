/**
 * crear-clientes-diversos.ts
 * Crea 6 clientes ficticios con perfiles muy distintos (patologías, deportes, objetivos).
 * Uso: npx tsx scripts/crear-clientes-diversos.ts
 */

import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const COACH_ID = 'f62aea4e-69a2-4062-b517-bb6a639ee1b5'

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

// ─── Colores CLI ──────────────────────────────────────────────────────────────
const c = {
  verde:   (s: string) => `\x1b[32m${s}\x1b[0m`,
  rojo:    (s: string) => `\x1b[31m${s}\x1b[0m`,
  amarillo:(s: string) => `\x1b[33m${s}\x1b[0m`,
  azul:    (s: string) => `\x1b[34m${s}\x1b[0m`,
  cielo:   (s: string) => `\x1b[36m${s}\x1b[0m`,
}

// ─── Definición de los 6 clientes ─────────────────────────────────────────────
const CLIENTES = [
  // ── 1. Carlos Rodríguez — Competidor Hyrox ────────────────────────────────
  {
    nombre:       'Carlos',
    apellidos:    'Rodríguez',
    email:        'carlos.rodriguez.hyrox@nutricoach-test.dev',
    cliente: {
      objetivo:                    'rendimiento',
      nivel:                       'avanzado',
      peso_inicial:                82,
      altura:                      180,
      edad:                        28,
      sexo:                        'hombre' as const,
      restricciones_alimentarias:  'Ninguna',
      notas:                       'Competidor Hyrox Madrid en 8 semanas. Dobles sesiones los jueves. Rendimiento puro.',
    },
    onboarding: {
      objetivo:              'rendimiento',
      actividad_base:        'muy_activo',
      dias_entreno:          6,
      tipo_entreno:          ['hyrox', 'fuerza_funcional', 'crossfit'],
      duracion_sesion_min:   90,
      restricciones:         [] as string[],
      alimentos_no_gustan:   'ninguno',
      alimentos_base:        ['arroz', 'pasta', 'pollo', 'huevo', 'plátano', 'dátiles'],
      nivel_cocina:          'basico',
      tiempo_cocina_min:     20,
      presupuesto_semanal_eur: 90,
      segmento:              'performance',
      objetivo_deportivo:    'Hyrox Madrid — clasificar en top 15%',
    },
    perfil: {
      trigger_onboarding:        'Hyrox Madrid en 8 semanas. Necesita poner la nutrición al nivel del entrenamiento.',
      condiciones_salud:         'Ninguna',
      comidas_favoritas:         'arroz con pollo, pasta con atún, tortillas de huevo, batidos de plátano y avena',
      alimentos_evitar_extra:    'nada',
      descripcion_semana_entreno:'L: fuerza funcional 90min. M: carrera + ski erg. X: HIT + SkiErg 2hs. J: fuerza mañana + cardio tarde (doble). V: técnica y velocidad. S: simulacro carrera completa. D: descanso activo.',
      fecha_competicion:         '2026-08-03',
      tipo_competicion:          'Hyrox Madrid Open',
      suplementos:               'Creatina 5g/día, cafeína pre-entreno, maltodextrina intra-entreno, whey post-entreno',
      hora_entreno:              '07:00 (L-M-V-S-D) / 07:00+17:00 (J)',
      nivel_estres:              3,
      calidad_sueno:             4,
    },
  },

  // ── 2. María Sánchez — Triatleta con hipotiroidismo ───────────────────────
  {
    nombre:       'María',
    apellidos:    'Sánchez',
    email:        'maria.sanchez.triatlon@nutricoach-test.dev',
    cliente: {
      objetivo:                    'rendimiento',
      nivel:                       'avanzado',
      peso_inicial:                58,
      altura:                      162,
      edad:                        38,
      sexo:                        'mujer' as const,
      restricciones_alimentarias:  'Sin goitrógenos crudos (brócoli, col) — hipotiroidismo',
      notas:                       'Triatleta Sprint en 6 semanas. Hipotiroidismo, levotiroxina. Sensible a goitrógenos crudos. 10-12h/semana de entrenamiento.',
    },
    onboarding: {
      objetivo:              'rendimiento',
      actividad_base:        'muy_activo',
      dias_entreno:          6,
      tipo_entreno:          ['natacion', 'ciclismo', 'running', 'triatlon'],
      duracion_sesion_min:   90,
      restricciones:         [] as string[],
      alimentos_no_gustan:   'col cruda, brócoli crudo',
      alimentos_base:        ['arroz', 'patata', 'pescado blanco', 'huevo', 'espinacas', 'yogur'],
      nivel_cocina:          'intermedio',
      tiempo_cocina_min:     40,
      presupuesto_semanal_eur: 80,
      segmento:              'performance',
      objetivo_deportivo:    'Triatlón Sprint Valencia — subir al podium AG 35-39F',
    },
    perfil: {
      trigger_onboarding:        'Necesita optimizar la recuperación entre sesiones triples. Hipotiroidismo condiciona metabolismo y requiere atención a yodo y selenio.',
      condiciones_salud:         'hipotiroidismo (levotiroxina 75mcg/día en ayunas). TSH 2.1 último control. Sensible a goitrógenos crudos: brócoli, col, coliflor, nabo sin cocinar alteran absorción de levotiroxina.',
      comidas_favoritas:         'arroz con merluza, tortilla de patata, yogur griego con fruta, ensalada de espinacas con huevo',
      alimentos_evitar_extra:    'brócoli crudo, col cruda, coliflor cruda, nabo crudo. Cocinados sí son seguros.',
      descripcion_semana_entreno:'L: natación técnica 45min. M: rodaje suave + fuerza core 60min. X: sesión larga bici 2h + transición run 20min. J: natación fondo 60min. V: series running. S: triatlón simulacro. D: descanso.',
      fecha_competicion:         '2026-07-19',
      tipo_competicion:          'Triatlón Sprint Valencia',
      suplementos:               'B12 (por exigencia triatlón), selenio 100mcg/día (compatible levotiroxina), omega-3 2g, vitamina D 1000UI',
      hora_entreno:              '06:30 (semana) / 08:00 (finde)',
      nivel_estres:              3,
      calidad_sueno:             3,
    },
  },

  // ── 3. Andrés López — Powerlifter con dislipidemia ────────────────────────
  {
    nombre:       'Andrés',
    apellidos:    'López',
    email:        'andres.lopez.powerlifting@nutricoach-test.dev',
    cliente: {
      objetivo:                    'recomposicion',
      nivel:                       'avanzado',
      peso_inicial:                95,
      altura:                      175,
      edad:                        45,
      sexo:                        'hombre' as const,
      restricciones_alimentarias:  'Ninguna (control dislipidemia)',
      notas:                       'Powerlifter experimentado. Objetivo: mantener fuerza, bajar colesterol LDL. RM: sentadilla 180kg, banca 130kg. Dislipidemia, en seguimiento médico.',
    },
    onboarding: {
      objetivo:              'mantener',
      actividad_base:        'moderado',
      dias_entreno:          4,
      tipo_entreno:          ['powerlifting', 'fuerza'],
      duracion_sesion_min:   90,
      restricciones:         [] as string[],
      alimentos_no_gustan:   'comida muy grasosa, ultraprocesados',
      alimentos_base:        ['carne roja magra', 'huevo', 'avena', 'nueces', 'salmón', 'lentejas'],
      nivel_cocina:          'intermedio',
      tiempo_cocina_min:     45,
      presupuesto_semanal_eur: 100,
      segmento:              'recomposicion',
      objetivo_deportivo:    'Mantener totales competitivos, normalizar perfil lipídico en 3 meses',
    },
    perfil: {
      trigger_onboarding:        'Analítica: LDL 168 mg/dL. Médico recomienda mejorar dieta. Carlos quiere solución sin perder fuerza ni masa.',
      condiciones_salud:         'dislipidemia: colesterol LDL 168 mg/dL, HDL 38 mg/dL, triglicéridos 210 mg/dL. Sin medicación (cambio dieta + 3 meses revisión). TA 130/85 (normal-alta). Sin diabetes.',
      comidas_favoritas:         'solomillo de ternera a la plancha, huevos revueltos con salmón, avena con nueces, lentejas con verduras',
      alimentos_evitar_extra:    'embutidos grasos, mantequilla en exceso, quesos curados en cantidad, fritos',
      descripcion_semana_entreno:'L: sentadilla (volumen 5×5). M: press banca + accesorios. X: descanso. J: peso muerto + jalones. V: descanso. S: sentadilla intensidad + banca. D: descanso.',
      fecha_competicion:         null,
      tipo_competicion:          null,
      suplementos:               'Creatina 5g/día, omega-3 4g/día (prescrito médico para triglicéridos), proteína whey post-entreno',
      hora_entreno:              '18:30',
      nivel_estres:              2,
      calidad_sueno:             4,
    },
  },

  // ── 4. Sofía Ruiz — Ciclista con colon irritable ──────────────────────────
  {
    nombre:       'Sofía',
    apellidos:    'Ruiz',
    email:        'sofia.ruiz.ciclismo@nutricoach-test.dev',
    cliente: {
      objetivo:                    'rendimiento',
      nivel:                       'intermedio',
      peso_inicial:                60,
      altura:                      168,
      edad:                        26,
      sexo:                        'mujer' as const,
      restricciones_alimentarias:  'Baja en FODMAPs (colon irritable) — sin cebolla, ajo crudo, legumbres, lactosa alta',
      notas:                       'Ciclista amateur. Rutas largas 80-150km fines de semana. SII diagnosticado. Protocolo FODMAP. No tolera: cebolla, ajo crudo, legumbres, lácteos de alta lactosa.',
    },
    onboarding: {
      objetivo:              'rendimiento',
      actividad_base:        'activo',
      dias_entreno:          5,
      tipo_entreno:          ['ciclismo', 'rodillo', 'fuerza'],
      duracion_sesion_min:   120,
      restricciones:         [] as string[],
      alimentos_no_gustan:   'cebolla, ajo crudo, legumbres, leche entera',
      alimentos_base:        ['arroz blanco', 'pollo', 'plátano', 'patata', 'zanahoria', 'atún'],
      nivel_cocina:          'basico',
      tiempo_cocina_min:     30,
      presupuesto_semanal_eur: 65,
      segmento:              'performance',
      objetivo_deportivo:    'Completar La Purito Andorra 2026 (210km) sin crisis intestinal',
    },
    perfil: {
      trigger_onboarding:        'Repite crisis digestivas en rutas largas. Necesita nutrición específica SII+rendimiento ciclismo.',
      condiciones_salud:         'colon_irritable (SII tipo mixto, diagnóstico 2023). Protocolo bajo en FODMAPs activo. Intolerancia a lactosa alta (tolera queso curado, yogur en cantidad moderada). No tolera: cebolla, ajo crudo, puerro, legumbres (lentejas, garbanzos, alubias), manzana cruda, centeno.',
      comidas_favoritas:         'arroz con pollo, patata cocida con atún, plátano con mantequilla de cacahuete (sin aditivos), zanahoria cocida',
      alimentos_evitar_extra:    'cebolla (toda forma), ajo crudo, puerro, legumbres, lácteos alta lactosa, trigo en gran cantidad, manzana cruda, pera',
      descripcion_semana_entreno:'L: rodillo 1h Z2. M: fuerza piernas 45min. X: rodillo 90min progresivo. J: descanso. V: rodillo 1h técnica. S: ruta larga 100-150km. D: descanso o rodaje corto.',
      fecha_competicion:         '2026-08-30',
      tipo_competicion:          'La Purito Andorra 210km',
      suplementos:               'Probióticos (Lactobacillus rhamnosus), electrolitos sin FODMAP, geles de arroz en competición',
      hora_entreno:              '07:00 (semana) / 07:30 (finde)',
      nivel_estres:              3,
      calidad_sueno:             3,
    },
  },

  // ── 5. Javier Morales — Runner recreativo, recomposición, prediabetes ─────
  {
    nombre:       'Javier',
    apellidos:    'Morales',
    email:        'javier.morales.runner@nutricoach-test.dev',
    cliente: {
      objetivo:                    'perder_grasa',
      nivel:                       'intermedio',
      peso_inicial:                88,
      altura:                      174,
      edad:                        52,
      sexo:                        'hombre' as const,
      restricciones_alimentarias:  'Sin Lactosa',
      notas:                       'Runner recreativo 30-50km/semana. Prediabetes leve (glucosa 108 ayunas). Sin lactosa. Quiere perder grasa manteniendo el rendimiento en running.',
    },
    onboarding: {
      objetivo:              'perder_grasa',
      actividad_base:        'moderado',
      dias_entreno:          4,
      tipo_entreno:          ['running', 'fuerza'],
      duracion_sesion_min:   60,
      restricciones:         ['Sin Lactosa'],
      alimentos_no_gustan:   'lácteos, nata, mantequilla',
      alimentos_base:        ['huevo', 'pollo', 'pescado azul', 'nueces', 'arroz', 'patata'],
      nivel_cocina:          'intermedio',
      tiempo_cocina_min:     35,
      presupuesto_semanal_eur: 75,
      segmento:              'recomposicion',
      objetivo_deportivo:    'Correr 10km en menos de 48 minutos. Perder 6-8kg sin perder ritmo.',
    },
    perfil: {
      trigger_onboarding:        'Revisión médica con glucosa 108 en ayunas. Médico advierte riesgo diabetes tipo 2. A los 52 años quiere revertirlo con dieta y ejercicio.',
      condiciones_salud:         'prediabetes (glucosa ayunas 108 mg/dL, HbA1c 5.7%). Sin medicación — objetivo: revertir con cambio hábitos en 6 meses. Intolerancia a lactosa (diagnosticada). Sin hipertensión ni dislipidemia.',
      comidas_favoritas:         'tortilla de patata sin lactosa, huevos revueltos con salmón, pollo al horno con patata, atún con arroz',
      alimentos_evitar_extra:    'leche entera, nata, mantequilla, helados, yogur normal (tolera yogur sin lactosa)',
      descripcion_semana_entreno:'M: carrera 8km suave. X: fuerza (gym) 45min. J: carrera 10km progresivo. S: tirada larga 15-20km. Martes adicional si llega a 4 días.',
      fecha_competicion:         null,
      tipo_competicion:          null,
      suplementos:               'Vitamina D 2000UI (déficit leve confirmado), omega-3 1g, magnesio 300mg noche',
      hora_entreno:              '07:00 (fines de semana) / 18:30 (semana)',
      nivel_estres:              3,
      calidad_sueno:             3,
    },
  },

  // ── 6. Natalia González — Maratoniana vegana, anemia ferropénica ──────────
  {
    nombre:       'Natalia',
    apellidos:    'González',
    email:        'natalia.gonzalez.maraton@nutricoach-test.dev',
    cliente: {
      objetivo:                    'rendimiento',
      nivel:                       'avanzado',
      peso_inicial:                54,
      altura:                      166,
      edad:                        34,
      sexo:                        'mujer' as const,
      restricciones_alimentarias:  'Vegano (sin carne, sin pescado, sin huevo, sin lácteos)',
      notas:                       'Maratoniana pico 80-90km/semana. Vegana estricta. Anemia ferropénica leve en tratamiento. Suplementa B12, hierro, omega-3 vegano.',
    },
    onboarding: {
      objetivo:              'rendimiento',
      actividad_base:        'muy_activo',
      dias_entreno:          6,
      tipo_entreno:          ['running', 'maratón'],
      duracion_sesion_min:   90,
      restricciones:         ['Vegano'],
      alimentos_no_gustan:   'todos los productos animales',
      alimentos_base:        ['legumbres', 'tofu', 'tempeh', 'quinoa', 'arroz', 'frutos secos', 'frutas'],
      nivel_cocina:          'avanzado',
      tiempo_cocina_min:     50,
      presupuesto_semanal_eur: 85,
      segmento:              'performance',
      objetivo_deportivo:    'Maratón Valencia diciembre 2026 — objetivo sub-3:15',
    },
    perfil: {
      trigger_onboarding:        'Ferritina 11 ng/mL (límite bajo). Médico indica hierro oral. Necesita optimizar hierro no hemo + cofactores vitamina C para absorción.',
      condiciones_salud:         'anemia ferropénica leve (ferritina 11 ng/mL, Hb 11.8 g/dL). En tratamiento con hierro bisglicinate 25mg/día. Vegana estricta 6 años. Sin otras patologías. VitB12 en rango (suplementada). VitD 32 ng/mL (rango bajo-normal).',
      comidas_favoritas:         'curry de lentejas rojas, tempeh a la plancha con arroz, smoothie bowl con frutos rojos y semillas de chía, tofu scramble con espinacas',
      alimentos_evitar_extra:    'cualquier producto de origen animal — carne, pescado, marisco, huevo, lácteos, miel, gelatina',
      descripcion_semana_entreno:'L: recuperación 8km. M: series (8×1000m). X: rodaje medio 14km. J: fuerza + core 45min. V: rodaje suave 10km. S: tirada larga 28-35km. D: descanso completo.',
      fecha_competicion:         '2026-12-06',
      tipo_competicion:          'Maratón Valencia',
      suplementos:               'B12 cianocobalamina 2000mcg/semana, hierro bisglicinate 25mg/día (con VitC), omega-3 algae 500mg DHA+EPA, VitD3 vegana 2000UI, zinc 15mg',
      hora_entreno:              '06:30',
      nivel_estres:              2,
      calidad_sueno:             4,
    },
  },
]

// ─── Función para crear un cliente completo ────────────────────────────────────
async function crearCliente(def: typeof CLIENTES[number], idx: number): Promise<string | null> {
  const label = `${def.nombre} ${def.apellidos} — ${def.cliente.objetivo} / ${def.cliente.edad}a`
  console.log(`\n${c.azul(`[${idx + 1}/6]`)} ${c.amarillo(label)}`)
  console.log(`  Email: ${def.email}`)

  // 1. Auth user
  let authUserId: string
  const { data: existingList } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
  const existing = existingList?.users.find(u => u.email === def.email)

  if (existing) {
    authUserId = existing.id
    console.log(`  ${c.amarillo('⚠')} Auth user ya existe: ${authUserId}`)
  } else {
    const { data: newUser, error: authErr } = await db.auth.admin.createUser({
      email: def.email,
      password: 'TestNutri2026!',
      email_confirm: true,
      user_metadata: { nombre: def.nombre, apellidos: def.apellidos, role: 'cliente' },
    })
    if (authErr) {
      console.error(`  ${c.rojo('✗')} Auth error: ${authErr.message}`)
      return null
    }
    authUserId = newUser.user.id
    console.log(`  ${c.verde('✓')} Auth user: ${authUserId}`)
  }

  // 2. Profile upsert
  const { error: profileErr } = await db.from('profiles').upsert({
    id: authUserId,
    nombre: def.nombre,
    apellidos: def.apellidos,
    email: def.email,
    role: 'cliente',
  }, { onConflict: 'id' })
  if (profileErr) console.warn(`  ${c.amarillo('⚠')} Profile: ${profileErr.message}`)
  else console.log(`  ${c.verde('✓')} Profile OK`)

  // 3. Clientes — buscar si ya existe
  const { data: existingCliente } = await db
    .from('clientes')
    .select('id')
    .eq('profile_id', authUserId)
    .maybeSingle()

  let clienteId: string
  const clientePayload = {
    profile_id: authUserId,
    coach_id: COACH_ID,
    ...def.cliente,
    activo: true,
    revisado_por_coach: false,
    onboarding_completado: true,
    updated_at: new Date().toISOString(),
  }

  if (existingCliente?.id) {
    const { data: upd, error } = await db
      .from('clientes').update(clientePayload)
      .eq('id', existingCliente.id).select('id').single()
    if (error) { console.error(`  ${c.rojo('✗')} Update cliente: ${error.message}`); return null }
    clienteId = upd!.id
    console.log(`  ${c.amarillo('⚠')} Cliente ya existía, actualizado: ${clienteId}`)
  } else {
    const { data: ins, error } = await db
      .from('clientes').insert(clientePayload).select('id').single()
    if (error) { console.error(`  ${c.rojo('✗')} Insert cliente: ${error.message}`); return null }
    clienteId = ins!.id
    console.log(`  ${c.verde('✓')} Cliente creado: ${clienteId}`)
  }

  // 4. onboarding_responses
  await db.from('onboarding_responses').delete().eq('cliente_id', clienteId)
  const { error: onbErr } = await db.from('onboarding_responses').insert({
    cliente_id: clienteId,
    ...def.onboarding,
  })
  if (onbErr) console.error(`  ${c.rojo('✗')} Onboarding: ${onbErr.message}`)
  else console.log(`  ${c.verde('✓')} onboarding_responses OK`)

  // 5. onboarding_perfil_profundo
  await db.from('onboarding_perfil_profundo').delete().eq('cliente_id', clienteId)
  const { error: profErr } = await db.from('onboarding_perfil_profundo').insert({
    cliente_id: clienteId,
    ...def.perfil,
  })
  if (profErr) console.error(`  ${c.rojo('✗')} Perfil profundo: ${profErr.message}`)
  else console.log(`  ${c.verde('✓')} onboarding_perfil_profundo OK`)

  return clienteId
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${c.cielo('══════════════════════════════════════════════════')}`)
  console.log(`${c.cielo('  🏋️ CREAR 6 CLIENTES DIVERSOS — NutriCoach')}`)
  console.log(`${c.cielo('══════════════════════════════════════════════════')}`)
  console.log(`  Supabase: ${supabaseUrl}`)
  console.log(`  Coach ID: ${COACH_ID}`)
  console.log(`  Fecha:    ${new Date().toISOString().slice(0, 10)}\n`)

  const resultados: { nombre: string; clienteId: string | null }[] = []

  for (let i = 0; i < CLIENTES.length; i++) {
    const clienteId = await crearCliente(CLIENTES[i], i)
    resultados.push({ nombre: `${CLIENTES[i].nombre} ${CLIENTES[i].apellidos}`, clienteId })
  }

  console.log(`\n${c.cielo('══════════════════════════════════════════════════')}`)
  console.log(`${c.cielo('  📊 RESUMEN FINAL')}`)
  console.log(`${c.cielo('══════════════════════════════════════════════════')}`)

  let ok = 0
  let fail = 0
  for (const r of resultados) {
    if (r.clienteId) {
      console.log(`  ${c.verde('✓')} ${r.nombre.padEnd(32)} cliente_id: ${c.cielo(r.clienteId)}`)
      ok++
    } else {
      console.log(`  ${c.rojo('✗')} ${r.nombre.padEnd(32)} FALLÓ`)
      fail++
    }
  }

  console.log(`\n  ${c.verde(`✓ Creados: ${ok}`)} / ${fail > 0 ? c.rojo(`✗ Fallos: ${fail}`) : c.verde('✗ Fallos: 0')}`)
  console.log(`\n  Accede en: /clientes (panel coach)`)
  console.log(`  Password clientes: TestNutri2026!\n`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
