import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const codigo = searchParams.get('codigo')
  const admin = createServiceSupabase()

  let clienteId: string | null = null

  if (codigo) {
    const { data: planPublico } = await admin
      .from('planes_nutricion')
      .select('cliente_id')
      .eq('codigo_publico', codigo)
      .eq('activo', true)
      .single()
    clienteId = planPublico?.cliente_id ?? null
  } else {
    const auth = createApiSupabase(request)
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: clienteData } = await admin
      .from('clientes')
      .select('id')
      .eq('profile_id', user.id)
      .single()
    clienteId = clienteData?.id ?? null
  }

  if (!clienteId) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  // Get session info
  const { data: sesion, error: sesionError } = await admin
    .from('sesiones_entrenamiento')
    .select('id, nombre, dia_semana, notas, contexto_ia, plan_id')
    .eq('id', id)
    .single()

  if (sesionError || !sesion) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

  // Verify ownership via plan
  const { data: plan } = await admin
    .from('planes_entrenamiento')
    .select('id, nombre, cliente_id')
    .eq('id', sesion.plan_id)
    .single()

  if (!plan || plan.cliente_id !== clienteId) {
    return NextResponse.json({ error: 'Sin acceso a esta sesión' }, { status: 403 })
  }

  // Get exercises with full join
  const { data: ejercicios } = await admin
    .from('sesion_ejercicios')
    .select(`
      id, orden, series, repeticiones, descanso_segundos,
      peso_sugerido, notas, contexto_ia,
      ejercicio:ejercicios(id, nombre, grupo_muscular, tipo, video_url, foto_url)
    `)
    .eq('sesion_id', id)
    .order('orden')

  return NextResponse.json({
    sesion: {
      id: sesion.id,
      nombre: sesion.nombre,
      dia_semana: sesion.dia_semana,
      notas: sesion.notas,
      contexto_ia: sesion.contexto_ia,
      plan: { nombre: plan.nombre, cliente_id: plan.cliente_id },
      ejercicios: ejercicios ?? [],
    },
  })
}
