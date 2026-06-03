import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export const PLAN_EDITOR_PLAN_SELECT = `
  id,
  nombre,
  activo,
  duracion_semanas,
  cliente_id,
  coach_id,
  cliente:clientes(profile:profiles!profile_id(nombre, apellidos))
`

export const PLAN_EDITOR_SESIONES_SELECT = `
  id,
  nombre,
  dia_semana,
  orden,
  duracion_estimada_min,
  contexto_ia,
  ejercicios:sesion_ejercicios(
    id,
    ejercicio_id,
    series,
    repeticiones,
    descanso_segundos,
    peso_sugerido,
    rpe,
    notas,
    instruccion_ejercicio,
    contexto_ia,
    orden,
    ejercicio:ejercicios(id, nombre, grupo_muscular, tipo, foto_url, video_url)
  )
`

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = createApiSupabase(request)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const admin = createServiceSupabase()

  const { data: plan, error: planError } = await admin
    .from('planes_entrenamiento')
    .select(PLAN_EDITOR_PLAN_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (planError) return NextResponse.json({ error: planError.message }, { status: 500 })
  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  if (plan.coach_id !== user.id) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const { data: sesiones, error: sesionesError } = await admin
    .from('sesiones_entrenamiento')
    .select(PLAN_EDITOR_SESIONES_SELECT)
    .eq('plan_id', id)
    .order('orden')

  if (sesionesError) return NextResponse.json({ error: sesionesError.message }, { status: 500 })

  return NextResponse.json({ plan, sesiones: sesiones ?? [] })
}
