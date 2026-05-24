import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabaseAuth = createApiSupabase(request)
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const db = createServiceSupabase()

  // Buscar el cliente ligado a este usuario
  const { data: cliente } = await db
    .from('clientes')
    .select('id, coach_id')
    .eq('profile_id', user.id)
    .single()

  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  // 1. Guardar onboarding básico (onboarding_responses)
  const { error: basicError } = await db
    .from('onboarding_responses')
    .upsert({
      cliente_id: cliente.id,
      segmento: body.segmento,
      objetivo: body.objetivo,
      actividad_base: body.actividad_base,
      dias_entreno: body.dias_entreno ?? 3,
      tipo_entreno: body.tipo_entreno ?? [],
      duracion_sesion_min: body.duracion_sesion_min ?? 60,
      restricciones: body.restricciones ?? [],
      alimentos_no_gustan: body.alimentos_no_gustan || null,
      nivel_cocina: body.nivel_cocina,
      tiempo_cocina_min: body.tiempo_cocina_min ?? 30,
      presupuesto_semanal_eur: body.presupuesto_semanal_eur || null,
      horario_comidas: body.horario_comidas || null,
      come_fuera_dias: body.come_fuera_dias ?? 0,
      alimentos_base: body.alimentos_base || null,
    }, { onConflict: 'cliente_id' })

  if (basicError) {
    console.error('[onboarding/completo] Error básico:', basicError)
    return NextResponse.json({ error: 'Error al guardar datos básicos' }, { status: 500 })
  }

  // 2. Actualizar datos físicos en el cliente
  await db
    .from('clientes')
    .update({
      peso_inicial: body.peso,
      altura: body.altura,
      edad: body.edad,
      sexo: body.sexo,
      objetivo: body.objetivo,
    })
    .eq('id', cliente.id)

  // 3. Guardar perfil profundo (onboarding_perfil_profundo)
  const { error: profundoError } = await db
    .from('onboarding_perfil_profundo')
    .upsert({
      cliente_id: cliente.id,
      trigger_onboarding: body.trigger_onboarding,
      autoeficacia: body.autoeficacia ?? null,
      historial_dietas: body.historial_dietas ?? [],
      razones_abandono: body.razones_abandono ?? [],
      relacion_comida: body.relacion_comida,
      todo_o_nada: body.todo_o_nada,
      dia_tipico: body.dia_tipico,
      comidas_favoritas: body.comidas_favoritas,
      alimentos_evitar_extra: body.alimentos_evitar_extra,
      alcohol_semanal: body.alcohol_semanal,
      suplementos: body.suplementos,
      come_fuera_dias: body.come_fuera_dias ?? 0,
      alimentos_base: body.alimentos_base || null,
      hora_primera_ingesta: body.hora_primera_ingesta,
      hora_comida_principal: body.hora_comida_principal,
      hora_ultima_ingesta: body.hora_ultima_ingesta,
      hora_entreno: body.hora_entreno,
      patrones_energia: body.patrones_energia ?? [],
      con_quien_come: body.con_quien_come ?? [],
      frecuencia_fuera: body.frecuencia_fuera,
      comida_trampa: body.comida_trampa,
      condiciones_salud: body.condiciones_salud,
      horas_sueno: body.horas_sueno ?? 7,
      calidad_sueno: body.calidad_sueno ?? 3,
      nivel_estres: body.nivel_estres ?? 2,
      descripcion_semana_entreno: body.descripcion_semana_entreno,
      fecha_competicion: body.fecha_competicion,
      tipo_competicion: body.tipo_competicion,
      nutricion_peri_entreno: body.nutricion_peri_entreno,
      analisis_disponibles: body.analisis_disponibles ?? [],
      analisis_valores: body.analisis_valores ?? {},
      tests_recomendados_pendientes: body.tests_recomendados_pendientes ?? [],
      composicion_metodo: body.composicion_metodo,
      composicion_grasa_pct: body.composicion_grasa_pct,
      composicion_masa_muscular_kg: body.composicion_masa_muscular_kg,
      composicion_objetivo_grasa_pct: body.composicion_objetivo_grasa_pct,
      peso_competicion: body.peso_competicion,
      vo2max: body.vo2max,
      notas_analisis: body.notas_analisis,
    }, { onConflict: 'cliente_id' })

  if (profundoError) {
    console.error('[onboarding/completo] Error perfil profundo:', profundoError)
    return NextResponse.json({ error: 'Error al guardar perfil profundo' }, { status: 500 })
  }

  // 4. Marcar onboarding completado
  await db
    .from('clientes')
    .update({ onboarding_completado: true })
    .eq('id', cliente.id)

  // 5. Disparar generación del plan UNA SOLA VEZ con todos los datos
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  fetch(`${baseUrl}/api/generar-plan-inicial`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cliente_id: cliente.id }),
  }).catch(() => {})

  return NextResponse.json({ cliente_id: cliente.id })
}
