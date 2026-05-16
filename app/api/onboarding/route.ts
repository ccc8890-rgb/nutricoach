import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabaseAuth = createApiSupabase(request)
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await request.json()
  const {
    objetivo, peso, altura, edad, sexo,
    actividad_base, dias_entreno, tipo_entreno, duracion_sesion_min,
    restricciones, alimentos_no_gustan,
    nivel_cocina, tiempo_cocina_min, presupuesto_semanal_eur,
  } = body

  if (!objetivo || !actividad_base || !nivel_cocina) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  const supabase = createServiceSupabase()

  // Find cliente by profile_id
  const { data: cliente, error: clienteError } = await supabase
    .from('clientes')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (clienteError || !cliente) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  // Update clientes with body data and objective
  await supabase
    .from('clientes')
    .update({
      objetivo,
      peso_inicial: peso,
      altura,
      edad,
      sexo,
      restricciones_alimentarias: restricciones?.join(', ') || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cliente.id)

  // Upsert onboarding_responses
  const { error: onboardingError } = await supabase
    .from('onboarding_responses')
    .upsert({
      cliente_id: cliente.id,
      objetivo,
      actividad_base,
      dias_entreno: dias_entreno ?? 3,
      tipo_entreno: tipo_entreno ?? [],
      duracion_sesion_min: duracion_sesion_min ?? 60,
      restricciones: restricciones ?? [],
      alimentos_no_gustan: alimentos_no_gustan || null,
      nivel_cocina,
      tiempo_cocina_min: tiempo_cocina_min ?? 30,
      presupuesto_semanal_eur: presupuesto_semanal_eur || null,
    }, { onConflict: 'cliente_id' })

  if (onboardingError) {
    return NextResponse.json({ error: 'Error al guardar onboarding' }, { status: 500 })
  }

  // Plan generation is triggered after the deep profile form (/api/onboarding/perfil)
  return NextResponse.json({ cliente_id: cliente.id })
}
