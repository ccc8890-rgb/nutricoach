import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

// GET — devuelve datos del onboarding básico para saber si es atleta y el cliente_id
export async function GET(request: NextRequest) {
  const supabaseAuth = createApiSupabase(request)
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceSupabase()
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: onboarding } = await supabase
    .from('onboarding_responses')
    .select('dias_entreno, segmento')
    .eq('cliente_id', cliente.id)
    .single()

  return NextResponse.json({
    cliente_id: cliente.id,
    dias_entreno: onboarding?.dias_entreno ?? 0,
    segmento: onboarding?.segmento ?? 'standard',
  })
}

// POST — guarda perfil profundo y dispara generación del plan
export async function POST(request: NextRequest) {
  const supabaseAuth = createApiSupabase(request)
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const supabase = createServiceSupabase()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { error: upsertError } = await supabase
    .from('onboarding_perfil_profundo')
    .upsert({
      cliente_id: cliente.id,
      trigger_onboarding: body.trigger_onboarding || null,
      autoeficacia: body.autoeficacia || null,
      historial_dietas: body.historial_dietas ?? [],
      razones_abandono: body.razones_abandono ?? [],
      relacion_comida: body.relacion_comida || null,
      todo_o_nada: body.todo_o_nada || null,
      dia_tipico: body.dia_tipico || null,
      comidas_favoritas: body.comidas_favoritas || null,
      alimentos_evitar_extra: body.alimentos_evitar_extra || null,
      alcohol_semanal: body.alcohol_semanal || null,
      suplementos: body.suplementos || null,
      hora_primera_ingesta: body.hora_primera_ingesta || null,
      hora_comida_principal: body.hora_comida_principal || null,
      hora_ultima_ingesta: body.hora_ultima_ingesta || null,
      hora_entreno: body.hora_entreno || null,
      patrones_energia: body.patrones_energia ?? [],
      con_quien_come: body.con_quien_come ?? [],
      frecuencia_fuera: body.frecuencia_fuera || null,
      comida_trampa: body.comida_trampa || null,
      condiciones_salud: body.condiciones_salud || null,
      horas_sueno: body.horas_sueno || null,
      calidad_sueno: body.calidad_sueno || null,
      nivel_estres: body.nivel_estres || null,
      descripcion_semana_entreno: body.descripcion_semana_entreno || null,
      fecha_competicion: body.fecha_competicion || null,
      tipo_competicion: body.tipo_competicion || null,
      nutricion_peri_entreno: body.nutricion_peri_entreno || null,
      analisis_disponibles: body.analisis_disponibles ?? [],
      analisis_valores: body.analisis_valores ?? {},
      tests_recomendados_pendientes: body.tests_recomendados_pendientes ?? [],
      composicion_metodo: body.composicion_metodo || null,
      composicion_grasa_pct: body.composicion_grasa_pct || null,
      composicion_masa_muscular_kg: body.composicion_masa_muscular_kg || null,
      composicion_objetivo_grasa_pct: body.composicion_objetivo_grasa_pct || null,
      peso_competicion: body.peso_competicion || null,
      vo2max: body.vo2max || null,
      notas_analisis: body.notas_analisis || null,
    }, { onConflict: 'cliente_id' })

  if (upsertError) {
    return NextResponse.json({ error: 'Error al guardar perfil' }, { status: 500 })
  }

  // Ahora sí lanzamos la generación del plan con todos los datos disponibles
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  fetch(`${baseUrl}/api/generar-plan-inicial`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cliente_id: cliente.id }),
  }).catch(() => {})

  return NextResponse.json({ cliente_id: cliente.id })
}
