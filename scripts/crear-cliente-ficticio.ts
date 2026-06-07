/**
 * crear-cliente-ficticio.ts
 * Crea la cliente ficticia "Laura García" con perfil completo en Supabase.
 * Uso: npx tsx scripts/crear-cliente-ficticio.ts
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

const LAURA_EMAIL = 'laura.garcia.test@nutricoach.dev'

async function main() {
  console.log('=== Creando cliente ficticia: Laura García ===\n')

  // ── 1. Crear auth user (así profiles se crea automáticamente vía trigger) ──
  console.log('1. Buscando/creando auth user...')
  let authUserId: string

  // Check if already exists
  const { data: existingUsers } = await db.auth.admin.listUsers({ page: 1, perPage: 100 })
  const existing = existingUsers?.users.find(u => u.email === LAURA_EMAIL)

  if (existing) {
    authUserId = existing.id
    console.log(`   Auth user ya existe: ${authUserId}`)
  } else {
    const { data: newUser, error: authError } = await db.auth.admin.createUser({
      email: LAURA_EMAIL,
      password: 'TestNutri2026!',
      email_confirm: true,
      user_metadata: {
        nombre: 'Laura',
        apellidos: 'García',
        role: 'cliente',
      },
    })

    if (authError) {
      console.error('Error creando auth user:', authError)
      process.exit(1)
    }
    authUserId = newUser.user.id
    console.log(`   Auth user creado: ${authUserId}`)
  }

  // ── 2. Actualizar/verificar profiles record ─────────────────────────────
  console.log('\n2. Actualizando profiles...')
  const { error: profileError } = await db
    .from('profiles')
    .upsert({
      id: authUserId,
      nombre: 'Laura',
      apellidos: 'García',
      email: LAURA_EMAIL,
      role: 'cliente',
    }, { onConflict: 'id' })

  if (profileError) {
    console.warn('   Aviso profiles:', profileError.message)
  } else {
    console.log('   Profile OK')
  }

  // ── 3. Crear/actualizar registro clientes ────────────────────────────────
  console.log('\n3. Creando registro en clientes...')

  const { data: existingCliente } = await db
    .from('clientes')
    .select('id')
    .eq('profile_id', authUserId)
    .maybeSingle()

  let clienteId: string

  const clientePayload = {
    profile_id: authUserId,
    coach_id: COACH_ID,
    objetivo: 'perder_grasa',
    nivel: 'intermedio',
    peso_inicial: 68,
    altura: 165,
    edad: 32,
    sexo: 'mujer',
    restricciones_alimentarias: 'Sin Gluten (celiaca)',
    notas: 'TEST: Laura García — cliente ficticia para pruebas E2E. Celiaca, resistencia a la insulina.',
    activo: true,
    revisado_por_coach: false,
    onboarding_completado: true,
    fecha_proxima_revision: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    updated_at: new Date().toISOString(),
  }

  if (existingCliente?.id) {
    const { data: updated, error } = await db
      .from('clientes')
      .update(clientePayload)
      .eq('id', existingCliente.id)
      .select('id')
      .single()
    if (error) { console.error('Error update cliente:', error); process.exit(1) }
    clienteId = updated!.id
    console.log(`   Cliente actualizado: ${clienteId}`)
  } else {
    const { data: inserted, error } = await db
      .from('clientes')
      .insert(clientePayload)
      .select('id')
      .single()
    if (error) { console.error('Error insert cliente:', error); process.exit(1) }
    clienteId = inserted!.id
    console.log(`   Cliente creado: ${clienteId}`)
  }

  // ── 4. onboarding_responses ─────────────────────────────────────────────
  console.log('\n4. Insertando onboarding_responses...')

  await db.from('onboarding_responses').delete().eq('cliente_id', clienteId)

  const { error: onbError } = await db.from('onboarding_responses').insert({
    cliente_id: clienteId,
    segmento: 'standard',
    objetivo: 'perder_grasa',
    actividad_base: 'moderado',
    dias_entreno: 3,
    tipo_entreno: ['fuerza'],
    duracion_sesion_min: 60,
    restricciones: ['Sin Gluten'],
    alimentos_no_gustan: 'pescado azul, hígado',  // text column, not array
    alimentos_base: ['pollo', 'huevo', 'arroz', 'yogur griego', 'espinacas'],
    nivel_cocina: 'basico',
    tiempo_cocina_min: 30,
    presupuesto_semanal_eur: 60,
  })

  if (onbError) {
    console.error('Error onboarding_responses:', onbError)
    process.exit(1)
  }
  console.log('   onboarding_responses OK')

  // ── 5. onboarding_perfil_profundo ────────────────────────────────────────
  console.log('\n5. Insertando onboarding_perfil_profundo...')

  await db.from('onboarding_perfil_profundo').delete().eq('cliente_id', clienteId)

  const { error: profError } = await db.from('onboarding_perfil_profundo').insert({
    cliente_id: clienteId,
    trigger_onboarding: 'Quiere perder grasa con celiaquía y resistencia a la insulina.',
    autoeficacia: 4,
    historial_dietas: ['Dieta sin gluten genérica', 'Seguimiento médico puntual'],
    razones_abandono: ['hambre', 'pocas opciones sin gluten'],
    relacion_comida: 'Relación funcional pero restrictiva por la celiaquía. Ansiedad ocasional por dulce.',
    todo_o_nada: 'a_veces',
    dia_tipico: 'Trabajo oficina, almuerzo fuera, cena en casa. 3 días gym por la tarde.',
    comidas_favoritas: 'bowl de arroz con pollo, tortilla de patata, yogur griego con fruta',   // text column
    alimentos_evitar_extra: 'gluten, cereales con gluten, cebada, centeno, espelta',             // text column
    alcohol_semanal: '0-1 consumiciones',
    suplementos: 'Ninguno actualmente.',
    hora_primera_ingesta: '08:00',
    hora_comida_principal: '14:00',
    hora_ultima_ingesta: '21:00',
    hora_entreno: '18:30',
    patrones_energia: ['bajada_tarde'],
    con_quien_come: ['pareja'],
    frecuencia_fuera: '1-2',
    comida_trampa: 'Cena del fin de semana',
    condiciones_salud: 'resistencia_insulina, celiaquía diagnosticada',
    horas_sueno: 7,
    calidad_sueno: 3,
    nivel_estres: 3,
    descripcion_semana_entreno: '3 días/semana: fuerza en gimnasio, ~60 min/sesión',
    fecha_competicion: null,
    tipo_competicion: null,
    nutricion_peri_entreno: 'Sin estrategia peri-entreno definida actualmente.',
    analisis_disponibles: ['glucosa_ayunas', 'insulina_ayunas'],
    analisis_valores: { glucosa_ayunas: 98, insulina_ayunas: 14 },
    composicion_metodo: 'bioimpedancia',
    composicion_grasa_pct: 30,
    composicion_masa_muscular_kg: 23,
    composicion_objetivo_grasa_pct: 24,
    notas_analisis: 'TEST: Laura García — perfil ficticio para pruebas E2E.',
  })

  if (profError) {
    console.error('Error onboarding_perfil_profundo:', profError)
    process.exit(1)
  }
  console.log('   onboarding_perfil_profundo OK')

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n=== RESUMEN ===')
  console.log(`auth_user_id  : ${authUserId}`)
  console.log(`profile_id    : ${authUserId}`)
  console.log(`cliente_id    : ${clienteId}`)
  console.log(`coach_id      : ${COACH_ID}`)
  console.log(`email         : ${LAURA_EMAIL}`)
  console.log(`password      : TestNutri2026!`)
  console.log(`revisar-plan  : /clientes/${clienteId}/revisar-plan`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
